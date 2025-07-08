import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

/**
 * Database Construct - Manages DynamoDB tables for email parsing system
 */
export class DatabaseConstruct extends Construct {
  public readonly emailTable: dynamodb.Table;
  public readonly supplierTable: dynamodb.Table;
  public readonly matchHistoryTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // DynamoDB table for parsed emails
    this.emailTable = new dynamodb.Table(this, 'ParsedEmailsTable', {
      tableName: 'parsed-emails',
      partitionKey: { name: 'emailId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // DynamoDB table for supplier catalog
    this.supplierTable = new dynamodb.Table(this, 'SupplierCatalogTable', {
      tableName: 'supplier-catalog',
      partitionKey: { name: 'supplierId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // GSI for searching suppliers by capabilities
    this.supplierTable.addGlobalSecondaryIndex({
      indexName: 'CapabilityIndex',
      partitionKey: { name: 'capability', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'supplierId', type: dynamodb.AttributeType.STRING },
    });

    // GSI for searching suppliers by business certifications
    this.supplierTable.addGlobalSecondaryIndex({
      indexName: 'BusinessCertificationIndex',
      partitionKey: { name: 'businessCertification', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'supplierId', type: dynamodb.AttributeType.STRING },
    });

    // Additional GSIs will be added in subsequent deployments due to DynamoDB limitations
    // TODO: Add GeographicIndex and ComplianceIndex in next deployment phases

    // DynamoDB table for match history
    this.matchHistoryTable = new dynamodb.Table(this, 'MatchHistoryTable', {
      tableName: 'match-history',
      partitionKey: { name: 'matchId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'emailId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });
  }
} 