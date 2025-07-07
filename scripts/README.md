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

These scripts help validate:
1. **S3 → Lambda trigger** - File upload triggers Email Processor Lambda
2. **EML parsing** - Headers and body extraction from .eml files
3. **EventBridge publishing** - "Email Received" events sent to `email-parsing-events` bus
4. **Factory Pattern preparation** - Different email types ready for parser selection

## Expected Flow

```
Upload .eml → S3 Trigger → Email Processor Lambda → EventBridge Event → SQS Queue → Email Parser Lambda (Phase 2 Step 2)
``` 