import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Import modular constructs
import { StorageConstruct } from './constructs/storage';
import { EventsConstruct } from './constructs/events';
import { QueuesConstruct } from './constructs/queues';
import { DatabaseConstruct } from './constructs/database';
import { LambdaConstruct } from './constructs/lambda';
import { ApiConstruct } from './constructs/api';
import { TriggersConstruct } from './constructs/triggers';
import { PermissionsConstruct } from './constructs/permissions';

/**
 * AI-Powered Government Email Parsing System Stack
 * Event-driven serverless architecture with modular design
 */
export class EmailParsingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =============================================================================
    // MODULAR CONSTRUCTS
    // =============================================================================

    // Storage layer - S3 bucket for email storage
    const storage = new StorageConstruct(this, 'Storage', {
      account: this.account,
      region: this.region,
    });

    // Events layer - EventBridge custom event bus
    const events = new EventsConstruct(this, 'Events');

    // Queues layer - SQS queues for processing pipeline
    const queues = new QueuesConstruct(this, 'Queues');

    // Database layer - DynamoDB tables
    const database = new DatabaseConstruct(this, 'Database');

    // Lambda layer - All Lambda functions
    const lambdas = new LambdaConstruct(this, 'Lambda', {
      region: this.region,
      emailEventBus: events.emailEventBus,
      emailParseQueue: queues.emailParseQueue,
      supplierMatchQueue: queues.supplierMatchQueue,
      processResultsQueue: queues.processResultsQueue,
      emailTable: database.emailTable,
      supplierTable: database.supplierTable,
      matchHistoryTable: database.matchHistoryTable,
    });

    // API layer - API Gateway and endpoints
    const api = new ApiConstruct(this, 'API', {
      apiLambda: lambdas.apiLambda,
    });

    // Triggers layer - Event sources and rules
    const triggers = new TriggersConstruct(this, 'Triggers', {
      emailEventBus: events.emailEventBus,
      emailParseQueue: queues.emailParseQueue,
      supplierMatchQueue: queues.supplierMatchQueue,
      emailParserLambda: lambdas.emailParserLambda,
      supplierMatcherLambda: lambdas.supplierMatcherLambda,
      emailProcessorLambda: lambdas.emailProcessorLambda,
      emailBucket: storage.emailBucket,
    });

    // Permissions layer - IAM permissions between services
    const permissions = new PermissionsConstruct(this, 'Permissions', {
      emailProcessorLambda: lambdas.emailProcessorLambda,
      emailParserLambda: lambdas.emailParserLambda,
      supplierMatcherLambda: lambdas.supplierMatcherLambda,
      apiLambda: lambdas.apiLambda,
      emailParseQueue: queues.emailParseQueue,
      supplierMatchQueue: queues.supplierMatchQueue,
      processResultsQueue: queues.processResultsQueue,
      emailTable: database.emailTable,
      supplierTable: database.supplierTable,
      matchHistoryTable: database.matchHistoryTable,
      emailEventBus: events.emailEventBus,
      emailBucket: storage.emailBucket,
    });

    // =============================================================================
    // STACK OUTPUTS
    // =============================================================================

    new cdk.CfnOutput(this, 'EmailBucketName', {
      value: storage.emailBucket.bucketName,
      description: 'Name of the S3 bucket for email storage',
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: events.emailEventBus.eventBusName,
      description: 'Name of the EventBridge event bus',
    });

    new cdk.CfnOutput(this, 'APIGatewayURL', {
      value: api.api.url,
      description: 'API Gateway URL for frontend integration',
    });

    new cdk.CfnOutput(this, 'EmailTableName', {
      value: database.emailTable.tableName,
      description: 'DynamoDB table name for parsed emails',
    });

    new cdk.CfnOutput(this, 'SupplierTableName', {
      value: database.supplierTable.tableName,
      description: 'DynamoDB table name for supplier catalog',
    });

    // Debug outputs for EventBridge and SQS
    new cdk.CfnOutput(this, 'EmailParseQueueUrl', {
      value: queues.emailParseQueue.queueUrl,
      description: 'SQS Email Parse Queue URL',
    });

    new cdk.CfnOutput(this, 'EmailReceivedRuleName', {
      value: triggers.emailReceivedRule.ruleName,
      description: 'EventBridge rule name for email received events',
    });
  }
}
