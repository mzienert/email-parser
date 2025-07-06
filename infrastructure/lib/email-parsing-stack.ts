import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sesActions from 'aws-cdk-lib/aws-ses-actions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';

/**
 * AI-Powered Government Email Parsing System Stack
 * Event-driven serverless architecture for intelligent email processing
 */
export class EmailParsingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =============================================================================
    // STORAGE LAYER
    // =============================================================================
    
    // S3 Bucket for email storage
    const emailBucket = new s3.Bucket(this, 'EmailStorageBucket', {
      bucketName: `email-parsing-mvp-${this.account}-${this.region}`,
      versioned: true,
      lifecycleRules: [
        {
          id: 'EmailArchival',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // =============================================================================
    // EMAIL RECEIVING INFRASTRUCTURE
    // =============================================================================
    
    // TODO: SES Receipt Rule Set (requires domain verification)
    // Commented out for MVP - would need verified domain
    // const ruleSet = new ses.ReceiptRuleSet(this, 'EmailReceiptRuleSet', {
    //   receiptRuleSetName: 'email-parsing-rules',
    // });

    // TODO: SES Receipt Rule to store emails in S3
    // const emailReceiptRule = new ses.ReceiptRule(this, 'EmailReceiptRule', {
    //   ruleSet: ruleSet,
    //   recipients: ['test@yourdomain.com'], // Would need verified domain
    //   actions: [
    //     new sesActions.S3({
    //       bucket: emailBucket,
    //       objectKeyPrefix: 'emails/',
    //     }),
    //   ],
    //   enabled: true,
    // });

    // =============================================================================
    // EVENT INFRASTRUCTURE
    // =============================================================================
    
    // EventBridge custom event bus
    const emailEventBus = new events.EventBus(this, 'EmailEventBus', {
      eventBusName: 'email-parsing-events',
      description: 'Event bus for email processing workflow',
    });

    // =============================================================================
    // QUEUE INFRASTRUCTURE
    // =============================================================================
    
    // Dead Letter Queue for failed processing
    const deadLetterQueue = new sqs.Queue(this, 'EmailProcessingDLQ', {
      queueName: 'email-parsing-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    // Email Parse Queue
    const emailParseQueue = new sqs.Queue(this, 'EmailParseQueue', {
      queueName: 'email-parse-queue',
      visibilityTimeout: cdk.Duration.minutes(5),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Supplier Match Queue
    const supplierMatchQueue = new sqs.Queue(this, 'SupplierMatchQueue', {
      queueName: 'supplier-match-queue',
      visibilityTimeout: cdk.Duration.minutes(3),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Process Results Queue
    const processResultsQueue = new sqs.Queue(this, 'ProcessResultsQueue', {
      queueName: 'process-results-queue',
      visibilityTimeout: cdk.Duration.minutes(2),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // =============================================================================
    // DATABASE LAYER
    // =============================================================================
    
    // DynamoDB table for parsed emails
    const emailTable = new dynamodb.Table(this, 'ParsedEmailsTable', {
      tableName: 'parsed-emails',
      partitionKey: { name: 'emailId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // DynamoDB table for supplier catalog
    const supplierTable = new dynamodb.Table(this, 'SupplierCatalogTable', {
      tableName: 'supplier-catalog',
      partitionKey: { name: 'supplierId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // GSI for searching suppliers by capabilities
    supplierTable.addGlobalSecondaryIndex({
      indexName: 'CapabilityIndex',
      partitionKey: { name: 'capability', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'supplierId', type: dynamodb.AttributeType.STRING },
    });

    // DynamoDB table for match history
    const matchHistoryTable = new dynamodb.Table(this, 'MatchHistoryTable', {
      tableName: 'match-history',
      partitionKey: { name: 'matchId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'emailId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // =============================================================================
    // LAMBDA FUNCTIONS (SCAFFOLDING)
    // =============================================================================
    
    // Bedrock IAM policy for Lambda functions
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
      ],
    });

    // Email Processor Lambda (receives emails from S3)
    const emailProcessorLambda = new lambda.Function(this, 'EmailProcessorLambda', {
      functionName: 'email-processor',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Email processor lambda triggered:', JSON.stringify(event, null, 2));
          // TODO: Implement email processing logic
          return { statusCode: 200, body: 'Email processed' };
        };
      `),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        EMAIL_PARSE_QUEUE_URL: emailParseQueue.queueUrl,
        EVENT_BUS_NAME: emailEventBus.eventBusName,
        BEDROCK_REGION: this.region,
      },
    });

    // Email Parser Lambda (processes emails with Bedrock)
    const emailParserLambda = new lambda.Function(this, 'EmailParserLambda', {
      functionName: 'email-parser',
      runtime: lambda.Runtime.NODEJS_18_X,
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
        SUPPLIER_MATCH_QUEUE_URL: supplierMatchQueue.queueUrl,
        EMAIL_TABLE_NAME: emailTable.tableName,
        BEDROCK_REGION: this.region,
      },
    });

    // Supplier Matcher Lambda (Strategy pattern matching)
    const supplierMatcherLambda = new lambda.Function(this, 'SupplierMatcherLambda', {
      functionName: 'supplier-matcher',
      runtime: lambda.Runtime.NODEJS_18_X,
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
        SUPPLIER_TABLE_NAME: supplierTable.tableName,
        MATCH_HISTORY_TABLE_NAME: matchHistoryTable.tableName,
        PROCESS_RESULTS_QUEUE_URL: processResultsQueue.queueUrl,
      },
    });

    // Add Bedrock permissions to relevant Lambda functions
    emailParserLambda.addToRolePolicy(bedrockPolicy);

    // =============================================================================
    // API GATEWAY
    // =============================================================================
    
    // API Gateway for frontend integration
    const api = new apigateway.RestApi(this, 'EmailParsingAPI', {
      restApiName: 'Email Parsing API',
      description: 'API for email parsing and supplier suggestions',
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'], // TODO: Restrict to Vercel domain in production
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // API Gateway integration lambda
    const apiLambda = new lambda.Function(this, 'APILambda', {
      functionName: 'email-parsing-api',
      runtime: lambda.Runtime.NODEJS_18_X,
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
        EMAIL_TABLE_NAME: emailTable.tableName,
        SUPPLIER_TABLE_NAME: supplierTable.tableName,
        MATCH_HISTORY_TABLE_NAME: matchHistoryTable.tableName,
      },
    });

    // API Gateway endpoints
    const integration = new apigateway.LambdaIntegration(apiLambda);
    
    const suppliersResource = api.root.addResource('suppliers');
    suppliersResource.addResource('suggest').addMethod('POST', integration);
    
    const emailsResource = api.root.addResource('emails');
    emailsResource.addResource('{id}').addResource('matches').addMethod('GET', integration);
    
    suppliersResource.addResource('feedback').addMethod('POST', integration);

    // =============================================================================
    // PERMISSIONS & TRIGGERS
    // =============================================================================
    
    // Grant permissions for Lambda functions to access DynamoDB
    emailTable.grantReadWriteData(emailParserLambda);
    emailTable.grantReadWriteData(apiLambda);
    supplierTable.grantReadWriteData(supplierMatcherLambda);
    supplierTable.grantReadWriteData(apiLambda);
    matchHistoryTable.grantReadWriteData(supplierMatcherLambda);
    matchHistoryTable.grantReadWriteData(apiLambda);

    // Grant permissions for Lambda functions to access SQS
    emailParseQueue.grantSendMessages(emailProcessorLambda);
    emailParseQueue.grantConsumeMessages(emailParserLambda);
    supplierMatchQueue.grantSendMessages(emailParserLambda);
    supplierMatchQueue.grantConsumeMessages(supplierMatcherLambda);
    processResultsQueue.grantSendMessages(supplierMatcherLambda);

    // Grant permissions for Lambda functions to access S3
    emailBucket.grantReadWrite(emailProcessorLambda);
    emailBucket.grantReadWrite(emailParserLambda);

    // Grant permissions for Lambda functions to access EventBridge
    emailEventBus.grantPutEventsTo(emailProcessorLambda);
    emailEventBus.grantPutEventsTo(emailParserLambda);
    emailEventBus.grantPutEventsTo(supplierMatcherLambda);

    // =============================================================================
    // EVENT SOURCES & TRIGGERS
    // =============================================================================
    
    // SQS event sources for Lambda functions
    const emailParseEventSource = new lambda.EventSourceMapping(this, 'EmailParseEventSource', {
      target: emailParserLambda,
      eventSourceArn: emailParseQueue.queueArn,
      batchSize: 10,
    });

    const supplierMatchEventSource = new lambda.EventSourceMapping(this, 'SupplierMatchEventSource', {
      target: supplierMatcherLambda,
      eventSourceArn: supplierMatchQueue.queueArn,
      batchSize: 10,
    });

    // EventBridge rules for event routing
    const emailReceivedRule = new events.Rule(this, 'EmailReceivedRule', {
      eventBus: emailEventBus,
      ruleName: 'email-received-rule',
      description: 'Routes email received events to parse queue',
      eventPattern: {
        source: ['email.processing'],
        detailType: ['Email Received'],
      },
      targets: [new targets.SqsQueue(emailParseQueue)],
    });

    const emailParsedRule = new events.Rule(this, 'EmailParsedRule', {
      eventBus: emailEventBus,
      ruleName: 'email-parsed-rule',
      description: 'Routes email parsed events to supplier match queue',
      eventPattern: {
        source: ['email.processing'],
        detailType: ['Email Parsed'],
      },
      targets: [new targets.SqsQueue(supplierMatchQueue)],
    });

    // S3 event notification to trigger email processing
    emailBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(emailProcessorLambda),
      { prefix: 'emails/' }
    );

    // =============================================================================
    // OUTPUTS
    // =============================================================================
    
    new cdk.CfnOutput(this, 'EmailBucketName', {
      value: emailBucket.bucketName,
      description: 'Name of the S3 bucket for email storage',
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: emailEventBus.eventBusName,
      description: 'Name of the EventBridge event bus',
    });

    new cdk.CfnOutput(this, 'APIGatewayURL', {
      value: api.url,
      description: 'API Gateway URL for frontend integration',
    });

    new cdk.CfnOutput(this, 'EmailTableName', {
      value: emailTable.tableName,
      description: 'DynamoDB table name for parsed emails',
    });

    new cdk.CfnOutput(this, 'SupplierTableName', {
      value: supplierTable.tableName,
      description: 'DynamoDB table name for supplier catalog',
    });
  }
}
