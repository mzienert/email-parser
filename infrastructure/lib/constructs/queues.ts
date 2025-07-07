import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';

/**
 * Queues Construct - Manages SQS queues for email processing pipeline
 */
export class QueuesConstruct extends Construct {
  public readonly deadLetterQueue: sqs.Queue;
  public readonly emailParseQueue: sqs.Queue;
  public readonly supplierMatchQueue: sqs.Queue;
  public readonly processResultsQueue: sqs.Queue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Dead Letter Queue for failed processing
    this.deadLetterQueue = new sqs.Queue(this, 'EmailProcessingDLQ', {
      queueName: 'email-parsing-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    // Email Parse Queue
    this.emailParseQueue = new sqs.Queue(this, 'EmailParseQueue', {
      queueName: 'email-parse-queue',
      visibilityTimeout: cdk.Duration.minutes(5),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Supplier Match Queue
    this.supplierMatchQueue = new sqs.Queue(this, 'SupplierMatchQueue', {
      queueName: 'supplier-match-queue',
      visibilityTimeout: cdk.Duration.minutes(3),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Process Results Queue
    this.processResultsQueue = new sqs.Queue(this, 'ProcessResultsQueue', {
      queueName: 'process-results-queue',
      visibilityTimeout: cdk.Duration.minutes(2),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });
  }
} 