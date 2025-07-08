import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

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
      // Allow public uploads for MVP - NOT for production use
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      // CORS configuration for web uploads
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      // Notification configuration for processing uploads
      eventBridgeEnabled: true,
    });

    // Bucket policy to allow public uploads to emails/ directory only
    this.emailBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowPublicEmailUploads',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [`${this.emailBucket.bucketArn}/emails/*`],
      })
    );
  }
} 