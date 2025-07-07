import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface StorageConstructProps {
  readonly account: string;
  readonly region: string;
}

/**
 * Storage Construct - Manages S3 bucket for email storage
 */
export class StorageConstruct extends Construct {
  public readonly emailBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);

    // S3 Bucket for email storage
    this.emailBucket = new s3.Bucket(this, 'EmailStorageBucket', {
      bucketName: `email-parsing-mvp-${props.account}-${props.region}`,
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
  }
} 