#!/bin/bash

# Upload all test emails for comprehensive testing
BUCKET="email-parsing-mvp-619326977873-us-west-2"
REGION="us-west-2"

echo "📧 Uploading all test emails for Factory Pattern testing..."
echo "Target: s3://$BUCKET/emails/"
echo "====================================================="

# Upload SEWP email
echo "1️⃣ Uploading SEWP test email..."
aws s3 cp "test-data/sewp-nutanix-rfq.eml" "s3://$BUCKET/emails/" --region "$REGION"
[ $? -eq 0 ] && echo "✅ SEWP email uploaded" || echo "❌ SEWP email failed"

echo ""

# Upload NASA email  
echo "2️⃣ Uploading NASA test email..."
aws s3 cp "test-data/nasa-networking-rfq.eml" "s3://$BUCKET/emails/" --region "$REGION"
[ $? -eq 0 ] && echo "✅ NASA email uploaded" || echo "❌ NASA email failed"

echo ""

# Upload GSA email
echo "3️⃣ Uploading GSA test email..."
aws s3 cp "test-data/gsa-generic-rfi.eml" "s3://$BUCKET/emails/" --region "$REGION"
[ $? -eq 0 ] && echo "✅ GSA email uploaded" || echo "❌ GSA email failed"

echo ""
echo "====================================================="
echo "📋 All uploads complete! Check S3 bucket:"
echo "aws s3 ls s3://$BUCKET/emails/ --region $REGION"
echo ""
echo "📊 Monitor Lambda processing:"
echo "aws logs tail /aws/lambda/email-processor --region $REGION --since 5m" 