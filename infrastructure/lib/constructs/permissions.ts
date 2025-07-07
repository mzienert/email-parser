import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface PermissionsConstructProps {
  readonly emailProcessorLambda: lambda.Function;
  readonly emailParserLambda: lambda.Function;
  readonly supplierMatcherLambda: lambda.Function;
  readonly apiLambda: lambda.Function;
  readonly emailParseQueue: sqs.Queue;
  readonly supplierMatchQueue: sqs.Queue;
  readonly processResultsQueue: sqs.Queue;
  readonly emailTable: dynamodb.Table;
  readonly supplierTable: dynamodb.Table;
  readonly matchHistoryTable: dynamodb.Table;
  readonly emailEventBus: events.EventBus;
  readonly emailBucket: s3.Bucket;
}

/**
 * Permissions Construct - Manages IAM permissions between services
 */
export class PermissionsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: PermissionsConstructProps) {
    super(scope, id);

    // DynamoDB permissions
    props.emailTable.grantReadWriteData(props.emailParserLambda);
    props.emailTable.grantReadWriteData(props.apiLambda);
    props.supplierTable.grantReadWriteData(props.supplierMatcherLambda);
    props.supplierTable.grantReadWriteData(props.apiLambda);
    props.matchHistoryTable.grantReadWriteData(props.supplierMatcherLambda);
    props.matchHistoryTable.grantReadWriteData(props.apiLambda);

    // SQS permissions
    props.emailParseQueue.grantSendMessages(props.emailProcessorLambda);
    props.emailParseQueue.grantConsumeMessages(props.emailParserLambda);
    props.supplierMatchQueue.grantSendMessages(props.emailParserLambda);
    props.supplierMatchQueue.grantConsumeMessages(props.supplierMatcherLambda);
    props.processResultsQueue.grantSendMessages(props.supplierMatcherLambda);

    // S3 permissions
    props.emailBucket.grantReadWrite(props.emailProcessorLambda);
    props.emailBucket.grantReadWrite(props.emailParserLambda);

    // EventBridge permissions
    props.emailEventBus.grantPutEventsTo(props.emailProcessorLambda);
    props.emailEventBus.grantPutEventsTo(props.emailParserLambda);
    props.emailEventBus.grantPutEventsTo(props.supplierMatcherLambda);
  }
} 