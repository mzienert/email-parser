import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export interface LambdaConstructProps {
  readonly region: string;
  readonly emailEventBus: events.EventBus;
  readonly emailParseQueue: sqs.Queue;
  readonly supplierMatchQueue: sqs.Queue;
  readonly processResultsQueue: sqs.Queue;
  readonly emailTable: dynamodb.Table;
  readonly supplierTable: dynamodb.Table;
  readonly matchHistoryTable: dynamodb.Table;
}

/**
 * Lambda Construct - Manages Lambda functions for email processing pipeline
 */
export class LambdaConstruct extends Construct {
  public readonly emailProcessorLambda: lambda.Function;
  public readonly emailParserLambda: lambda.Function;
  public readonly supplierMatcherLambda: lambda.Function;
  public readonly apiLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    // Bedrock IAM policy for Lambda functions
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${props.region}::foundation-model/us.anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:${props.region}::foundation-model/us.anthropic.claude-4-sonnet-20241022-v1:0`,
        `arn:aws:bedrock:${props.region}::foundation-model/us.anthropic.claude-4-opus-20241022-v1:0`,
      ],
    });

    // Email Processor Lambda (receives emails from S3)
    this.emailProcessorLambda = new lambda.Function(this, 'EmailProcessorLambda', {
      functionName: 'email-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
        const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
        
        const s3 = new S3Client({ region: process.env.AWS_REGION });
        const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });
        
        exports.handler = async (event) => {
          console.log('Email processor lambda triggered:', JSON.stringify(event, null, 2));
          
          try {
            // Process each S3 record
            for (const record of event.Records) {
              if (record.eventName === 'ObjectCreated:Put') {
                const bucket = record.s3.bucket.name;
                const key = record.s3.object.key;
                
                console.log(\`Processing email file: \${bucket}/\${key}\`);
                
                // Only process .eml files in the emails/ prefix
                if (key.startsWith('emails/') && key.endsWith('.eml')) {
                  const emailData = await processEmailFile(bucket, key);
                  
                  // Publish email received event to EventBridge
                  await publishEmailReceivedEvent(emailData);
                  
                  console.log('Successfully processed email:', emailData.emailId);
                } else {
                  console.log('Skipping non-email file:', key);
                }
              }
            }
            
            return { statusCode: 200, body: 'Email(s) processed successfully' };
          } catch (error) {
            console.error('Error processing email:', error);
            throw error;
          }
        };
        
        async function processEmailFile(bucket, key) {
          // Download .eml file from S3
          const command = new GetObjectCommand({ Bucket: bucket, Key: key });
          const response = await s3.send(command);
          
          // Convert stream to string
          const emailContent = await streamToString(response.Body);
          
          // Parse .eml file for basic metadata
          const emailData = parseEmailMetadata(emailContent, key);
          
          return emailData;
        }
        
        async function streamToString(stream) {
          const chunks = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks).toString('utf-8');
        }
        
        function parseEmailMetadata(emailContent, key) {
          const lines = emailContent.split('\\n');
          const headers = {};
          let bodyStart = 0;
          
          // Parse email headers
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') {
              bodyStart = i + 1;
              break;
            }
            
            const headerMatch = line.match(/^([^:]+):\\s*(.*)$/);
            if (headerMatch) {
              const [, name, value] = headerMatch;
              headers[name.toLowerCase()] = value;
            }
          }
          
          // Extract email body
          const body = lines.slice(bodyStart).join('\\n');
          
          // Generate email ID from S3 key
          const emailId = key.replace('emails/', '').replace('.eml', '');
          
          return {
            emailId,
            s3Key: key,
            headers,
            body: body.trim(),
            subject: headers.subject || 'No Subject',
            from: headers.from || 'Unknown Sender',
            to: headers.to || 'Unknown Recipient',
            date: headers.date || new Date().toISOString(),
            timestamp: new Date().toISOString()
          };
        }
        
        async function publishEmailReceivedEvent(emailData) {
          const eventDetail = {
            emailId: emailData.emailId,
            s3Key: emailData.s3Key,
            subject: emailData.subject,
            from: emailData.from,
            to: emailData.to,
            timestamp: emailData.timestamp,
            contentPreview: emailData.body.substring(0, 200) + '...'
          };
          
          const command = new PutEventsCommand({
            Entries: [
              {
                Source: 'email.processing',
                DetailType: 'Email Received',
                Detail: JSON.stringify(eventDetail),
                EventBusName: process.env.EVENT_BUS_NAME
              }
            ]
          });
          
          console.log('Publishing EventBridge event:', JSON.stringify(eventDetail, null, 2));
          
          const result = await eventBridge.send(command);
          console.log('EventBridge result:', result);
          
          return result;
        }
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        EMAIL_PARSE_QUEUE_URL: props.emailParseQueue.queueUrl,
        EVENT_BUS_NAME: props.emailEventBus.eventBusName,
        BEDROCK_REGION: props.region,
        BEDROCK_MODEL_ID: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
      },
    });

    // Email Parser Lambda (processes emails with Bedrock)
    this.emailParserLambda = new lambda.Function(this, 'EmailParserLambda', {
      functionName: 'email-parser',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Email parser lambda triggered:', JSON.stringify(event, null, 2));
          // TODO: Implement Factory pattern parser with Bedrock integration
          return { statusCode: 200, body: 'Email parsed' };
        };
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        SUPPLIER_MATCH_QUEUE_URL: props.supplierMatchQueue.queueUrl,
        EMAIL_TABLE_NAME: props.emailTable.tableName,
        BEDROCK_REGION: props.region,
        BEDROCK_MODEL_ID: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
      },
    });

    // Supplier Matcher Lambda (Strategy pattern matching)
    this.supplierMatcherLambda = new lambda.Function(this, 'SupplierMatcherLambda', {
      functionName: 'supplier-matcher',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Supplier matcher lambda triggered:', JSON.stringify(event, null, 2));
          // TODO: Implement Strategy pattern supplier matching
          return { statusCode: 200, body: 'Suppliers matched' };
        };
      `),
      timeout: cdk.Duration.minutes(3),
      memorySize: 512,
      environment: {
        SUPPLIER_TABLE_NAME: props.supplierTable.tableName,
        MATCH_HISTORY_TABLE_NAME: props.matchHistoryTable.tableName,
        PROCESS_RESULTS_QUEUE_URL: props.processResultsQueue.queueUrl,
      },
    });

    // API Gateway integration lambda
    this.apiLambda = new lambda.Function(this, 'APILambda', {
      functionName: 'email-parsing-api',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('API lambda triggered:', JSON.stringify(event, null, 2));
          // TODO: Implement API endpoints
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ message: 'API placeholder' }),
          };
        };
      `),
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      environment: {
        EMAIL_TABLE_NAME: props.emailTable.tableName,
        SUPPLIER_TABLE_NAME: props.supplierTable.tableName,
        MATCH_HISTORY_TABLE_NAME: props.matchHistoryTable.tableName,
      },
    });

    // Add Bedrock permissions to relevant Lambda functions
    this.emailParserLambda.addToRolePolicy(bedrockPolicy);
  }
} 