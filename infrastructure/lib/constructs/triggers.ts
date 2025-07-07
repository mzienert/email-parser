import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';

export interface TriggersConstructProps {
  readonly emailEventBus: events.EventBus;
  readonly emailParseQueue: sqs.Queue;
  readonly supplierMatchQueue: sqs.Queue;
  readonly emailParserLambda: lambda.Function;
  readonly supplierMatcherLambda: lambda.Function;
  readonly emailProcessorLambda: lambda.Function;
  readonly emailBucket: s3.Bucket;
}

/**
 * Triggers Construct - Manages event sources, rules, and triggers
 */
export class TriggersConstruct extends Construct {
  public readonly emailParseEventSource: lambda.EventSourceMapping;
  public readonly supplierMatchEventSource: lambda.EventSourceMapping;
  public readonly emailReceivedRule: events.Rule;
  public readonly emailParsedRule: events.Rule;

  constructor(scope: Construct, id: string, props: TriggersConstructProps) {
    super(scope, id);

    // SQS event sources for Lambda functions
    this.emailParseEventSource = new lambda.EventSourceMapping(this, 'EmailParseEventSource', {
      target: props.emailParserLambda,
      eventSourceArn: props.emailParseQueue.queueArn,
      batchSize: 10,
    });

    this.supplierMatchEventSource = new lambda.EventSourceMapping(this, 'SupplierMatchEventSource', {
      target: props.supplierMatcherLambda,
      eventSourceArn: props.supplierMatchQueue.queueArn,
      batchSize: 10,
    });

    // EventBridge rules for event routing
    this.emailReceivedRule = new events.Rule(this, 'EmailReceivedRule', {
      eventBus: props.emailEventBus,
      ruleName: 'email-received-rule',
      description: 'Routes email received events to parse queue',
      eventPattern: {
        source: ['email.processing'],
        detailType: ['Email Received'],
      },
      targets: [new targets.SqsQueue(props.emailParseQueue)],
    });

    this.emailParsedRule = new events.Rule(this, 'EmailParsedRule', {
      eventBus: props.emailEventBus,
      ruleName: 'email-parsed-rule',
      description: 'Routes email parsed events to supplier match queue',
      eventPattern: {
        source: ['email.processing'],
        detailType: ['Email Parsed'],
      },
      targets: [new targets.SqsQueue(props.supplierMatchQueue)],
    });

    // S3 event notification to trigger email processing
    props.emailBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(props.emailProcessorLambda),
      { prefix: 'emails/' }
    );
  }
} 