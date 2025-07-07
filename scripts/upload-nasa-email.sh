#!/bin/bash

# Upload NASA Networking RFQ test email
BUCKET="email-parsing-mvp-619326977873-us-west-2"
REGION="us-west-2"
FILE="test-data/nasa-networking-rfq.eml"

echo "Uploading NASA test email: $FILE"
echo "Target: s3://$BUCKET/emails/"

aws s3 cp "$FILE" "s3://$BUCKET/emails/" --region "$REGION"

if [ $? -eq 0 ]; then
    echo "✅ Successfully uploaded $FILE"
    echo "📋 Monitor logs: aws logs tail /aws/lambda/email-processor --region $REGION --since 2m"
else
    echo "❌ Failed to upload $FILE"
    exit 1
fi 