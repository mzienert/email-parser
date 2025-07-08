# Email Parser Test Scripts

This directory contains utility scripts for testing the email parsing system.

## Upload Scripts

### Individual Email Upload
Test specific parser types by uploading individual emails:

```bash
# Upload SEWP email (triggers SEWPParser)
./scripts/upload-sewp-email.sh

# Upload NASA email (triggers NASAParser)  
./scripts/upload-nasa-email.sh

# Upload GSA email (triggers GenericParser)
./scripts/upload-gsa-email.sh
```

### Upload All Test Emails
Upload all test emails at once for comprehensive testing:

```bash
./scripts/upload-all-test-emails.sh
```

## Cleanup Script

Clean up all files from the S3 emails directory:

```bash
./scripts/cleanup-emails.sh
```

**Note**: This script will prompt for confirmation before deleting files.

## Monitoring

All upload scripts provide monitoring commands. After uploading, monitor Lambda processing with:

```bash
# View recent Lambda logs
aws logs tail /aws/lambda/email-processor --region us-west-2 --since 5m

# Check S3 bucket contents
aws s3 ls s3://email-parsing-mvp-619326977873-us-west-2/emails/ --region us-west-2
```

## Test Files

The scripts upload these test files:
- `test-data/sewp-nutanix-rfq.eml` - SEWP V test email (structured format)
- `test-data/nasa-networking-rfq.eml` - NASA test email (space/security requirements)  
- `test-data/gsa-generic-rfi.eml` - GSA generic test email (unstructured format)

## Architecture Testing

These scripts help validate the complete end-to-end pipeline:
1. **S3 → Lambda trigger** - File upload triggers Email Processor Lambda
2. **EML parsing** - Headers and body extraction from .eml files
3. **EventBridge publishing** - "Email Received" events sent to `email-parsing-events` bus
4. **Factory Pattern** - Automatic parser selection (SEWPParser, NASAParser, GenericParser)
5. **Bedrock Integration** - Hybrid rule-based + LLM extraction (5-7s processing)
6. **Strategy Pattern** - Multi-algorithm supplier matching with compliance filtering
7. **Match Results** - Supplier ranking and DynamoDB persistence

## Complete Flow (Phase 1-3)

```
Upload .eml → S3 Trigger → Email Processor Lambda → EventBridge Event → 
SQS Queue → Email Parser Lambda (Factory Pattern + Bedrock) → 
EmailParsed Event → Supplier Matcher Lambda (Strategy Pattern) → 
Match Results → DynamoDB + Process Queue
```

## Monitoring Complete Pipeline

After uploading, monitor the full pipeline with:

```bash
# Monitor email processor
aws logs tail /aws/lambda/email-processor --region us-west-2 --since 5m

# Monitor email parser (Factory Pattern + Bedrock)
aws logs tail /aws/lambda/email-parser --region us-west-2 --since 5m

# Monitor supplier matcher (Strategy Pattern)
aws logs tail /aws/lambda/supplier-matcher --region us-west-2 --since 5m

# Check DynamoDB results
aws dynamodb scan --table-name parsed-emails --region us-west-2
aws dynamodb scan --table-name match-history --region us-west-2
```

## Sample Data Integration

### Supplier Catalog
Import sample suppliers for testing:

```bash
# Import 3 Nutanix authorized resellers
node scripts/import-sample-suppliers.js

# Verify suppliers imported
aws dynamodb scan --table-name supplier-catalog --region us-west-2 --select COUNT
```

### Expected Results
- **Federal Tech Solutions LLC** (WV, HUBZone+SDVOSB) - Best match for SEWP emails
- **Enterprise Government Solutions Inc** (NJ, 8(a)+WOSB) - Large business option
- **Mountain State Technology Partners** (WV, HUBZone) - Regional small business

## API Endpoint Testing ✅ **AVAILABLE**

After processing emails, test the REST API endpoints:

```bash
# Get supplier match results for processed email
curl -X GET "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/emails/sewp-nutanix-rfq/matches"

# Get supplier suggestions for new requirements
curl -X POST "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/suppliers/suggest" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Nutanix software"}],"requirements":{"taaCompliant":true}}'

# Submit feedback on matches
curl -X POST "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/suppliers/feedback" \
  -H "Content-Type: application/json" \
  -d '{"emailId":"sewp-nutanix-rfq","supplierId":"SUPP-001","feedback":"good_match","rating":4}'
```

## Performance Metrics

Current pipeline performance:
- **Email Processing**: ~500ms (S3 → EventBridge)
- **Parser Selection**: ~150ms (Factory pattern detection)
- **Bedrock Extraction**: ~5-7s (hybrid LLM + rule-based)
- **Supplier Matching**: ~150-415ms (3-strategy scoring)
- **API Response Time**: ~80-250ms (real-time suggestions)
- **Total E2E**: ~6-8s (email → supplier matches) 