# Email Parser Infrastructure

AWS CDK infrastructure for the AI-Powered Government Email Parsing System.

## Project Overview

This CDK project deploys a complete serverless email parsing and supplier matching system with event-driven architecture.

## Current Infrastructure Status

### **Deployed Resources** ✅
- **S3 Bucket**: `email-parsing-mvp-619326977873-us-west-2` (email storage)
- **API Gateway**: `https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/`
- **EventBridge Bus**: `email-parsing-events` (custom event bus)
- **DynamoDB Tables**: 
  - `parsed-emails` (email parsing results)
  - `supplier-catalog` (supplier data with 3 active suppliers)
  - `match-history` (supplier matching results)
- **Lambda Functions**:
  - `email-processor` (S3 → EventBridge ingestion)
  - `email-parser` (Factory pattern parsing with Bedrock)
  - `supplier-matcher` (Strategy pattern matching)
  - `api-handler` (REST API endpoints)
- **SQS Queues**: Parse, match, and process queues with DLQ error handling
- **Lambda Layers**: Parsers layer, strategies layer, utilities layer

### **Architecture Highlights**
- **Event-Driven**: S3 → EventBridge → SQS → Lambda flow
- **Modular CDK**: 8 construct modules with single responsibility
- **Bedrock Integration**: Claude 3.7 Sonnet, Claude Sonnet 4, Claude Opus 4
- **IAM Security**: Proper permissions for DynamoDB, Bedrock, EventBridge, SQS

## CDK Structure

```
lib/
├── constructs/
│   ├── api.ts           # API Gateway and Lambda handlers
│   ├── database.ts      # DynamoDB tables and GSIs
│   ├── events.ts        # EventBridge custom bus and rules
│   ├── lambda.ts        # Lambda functions and layers
│   ├── permissions.ts   # IAM roles and policies
│   ├── queues.ts        # SQS queues and DLQ
│   ├── storage.ts       # S3 buckets and notifications
│   └── triggers.ts      # Event triggers and targets
└── email-parsing-stack.ts  # Main stack orchestration
```

## Deployment Commands

### **Deploy Infrastructure**
```bash
# Deploy complete stack
cdk deploy --require-approval never

# Deploy with confirmation
cdk deploy

# Check differences before deployment
cdk diff
```

### **Development Commands**
```bash
# Compile TypeScript to JavaScript
npm run build

# Watch for changes and compile
npm run watch

# Run unit tests
npm run test

# Generate CloudFormation template
cdk synth
```

### **Utility Commands**
```bash
# Bootstrap CDK (first time only)
cdk bootstrap

# List all stacks
cdk list

# Destroy infrastructure (careful!)
cdk destroy
```

## Environment Variables

The following environment variables are configured for Lambda functions:
- `PARSED_EMAILS_TABLE_NAME`: DynamoDB table for parsed emails
- `SUPPLIER_TABLE_NAME`: DynamoDB table for supplier catalog
- `MATCH_HISTORY_TABLE_NAME`: DynamoDB table for match history
- `EMAIL_PARSE_QUEUE_URL`: SQS queue for email parsing
- `SUPPLIER_MATCH_QUEUE_URL`: SQS queue for supplier matching
- `PROCESS_RESULTS_QUEUE_URL`: SQS queue for result processing
- `EVENT_BUS_NAME`: EventBridge custom bus name
- `AWS_REGION`: AWS region for resources

## Testing the Infrastructure

### **Upload Test Email**
```bash
# From project root
aws s3 cp test-data/sewp-nutanix-rfq.eml s3://email-parsing-mvp-619326977873-us-west-2/emails/
```

### **Monitor Logs**
```bash
# Email processor logs
aws logs tail /aws/lambda/email-processor --region us-west-2 --follow

# Email parser logs
aws logs tail /aws/lambda/email-parser --region us-west-2 --follow

# Supplier matcher logs
aws logs tail /aws/lambda/supplier-matcher --region us-west-2 --follow
```

### **Check DynamoDB Data**
```bash
# Check parsed emails
aws dynamodb scan --table-name parsed-emails --region us-west-2

# Check supplier catalog
aws dynamodb scan --table-name supplier-catalog --region us-west-2

# Check match history
aws dynamodb scan --table-name match-history --region us-west-2
```

## Production Considerations

### **Security**
- VPC deployment for Lambda functions
- Encryption at rest for DynamoDB and S3
- WAF for API Gateway
- CloudTrail for audit logging

### **Monitoring**
- CloudWatch alarms for Lambda errors
- DynamoDB metrics monitoring
- API Gateway request/error tracking
- Custom metrics for business logic

### **Scaling**
- DynamoDB auto-scaling configuration
- Lambda concurrency limits
- SQS visibility timeout optimization
- EventBridge rule filtering

## Troubleshooting

### **Common Issues**
1. **Lambda timeout**: Increase timeout in `lambda.ts`
2. **DynamoDB throttling**: Enable auto-scaling or increase capacity
3. **SQS message loops**: Check DLQ configuration
4. **Bedrock access**: Verify model access in AWS console

### **Debug Commands**
```bash
# Check CloudFormation stack
aws cloudformation describe-stacks --stack-name EmailParsingStack

# Check Lambda function configuration
aws lambda get-function --function-name email-processor

# Check EventBridge rules
aws events list-rules --event-bus-name email-parsing-events
```

## Architecture Status

**✅ Phase 1-3 Complete**: Full infrastructure operational with Factory and Strategy patterns implemented.

**⏳ Phase 4 Next**: API Gateway endpoints for frontend integration.
