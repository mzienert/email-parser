import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
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

    // Create Lambda Layer for shared utilities
    const utilitiesLayer = new lambda.LayerVersion(this, 'UtilitiesLayer', {
      layerVersionName: 'email-parsing-utilities',
      code: lambda.Code.fromAsset('../src/utilities', {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          user: 'root',
          command: [
            'bash', '-c', [
              'mkdir -p /asset-output/nodejs',
              'cp -r /asset-input/* /asset-output/nodejs/',
              'cd /asset-output/nodejs',
              'npm init -y',
              'npm install'
            ].join(' && ')
          ]
        }
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Shared utilities for email parsing Lambda functions (logger, response helpers)',
    });

    // Create Lambda Layer for Bedrock integration
    const bedrockLayer = new lambda.LayerVersion(this, 'BedrockLayer', {
      layerVersionName: 'email-parsing-bedrock',
      code: lambda.Code.fromAsset('../src/bedrock', {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          user: 'root',
          command: [
            'bash', '-c', [
              'mkdir -p /asset-output/nodejs',
              'cp -r /asset-input/* /asset-output/nodejs/',
              'cd /asset-output/nodejs',
              'npm init -y',
              'npm install @aws-sdk/client-bedrock-runtime'
            ].join(' && ')
          ]
        }
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Bedrock LLM integration utilities for email parsing',
    });

    // Create Lambda Layer for parsers and factory
    const parsersLayer = new lambda.LayerVersion(this, 'ParsersLayer', {
      layerVersionName: 'email-parsing-parsers',
      code: lambda.Code.fromAsset('../src', {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          user: 'root',
          command: [
            'bash', '-c', [
              'mkdir -p /asset-output/nodejs',
              'cp -r /asset-input/parsers /asset-output/nodejs/',
              'cp -r /asset-input/factory /asset-output/nodejs/',
              'cd /asset-output/nodejs',
              'npm init -y',
              'npm install'
            ].join(' && ')
          ]
        }
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Email parsing parsers and factory (SEWP, NASA, Generic parsers)',
    });

    // Bedrock IAM policy for Lambda functions (cross-region inference support)
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        // Cross-region inference profiles for Claude 3.7 Sonnet
        `arn:aws:bedrock:us-west-2:${Stack.of(this).account}:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:us-east-1:${Stack.of(this).account}:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0`,
        // Foundation models (AWS SDK routes inference profiles to these)
        `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:${props.region}::foundation-model/anthropic.claude-4-sonnet-20241022-v1:0`,
        `arn:aws:bedrock:${props.region}::foundation-model/anthropic.claude-4-opus-20241022-v1:0`,
      ],
    });

    // Email Processor Lambda (receives emails from S3)
    this.emailProcessorLambda = new lambda.Function(this, 'EmailProcessorLambda', {
      functionName: 'email-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../src/lambda/email-processor'),
      layers: [utilitiesLayer],
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
      code: lambda.Code.fromAsset('../src/lambda/email-parser'),
      layers: [utilitiesLayer, bedrockLayer, parsersLayer],
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        SUPPLIER_MATCH_QUEUE_URL: props.supplierMatchQueue.queueUrl,
        EMAIL_TABLE_NAME: props.emailTable.tableName,
        EVENT_BUS_NAME: props.emailEventBus.eventBusName,
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