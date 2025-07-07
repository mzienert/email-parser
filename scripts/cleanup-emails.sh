#!/bin/bash

# Clean up all files from the S3 emails directory
BUCKET="email-parsing-mvp-619326977873-us-west-2"
REGION="us-west-2"
PREFIX="emails/"

echo "🧹 Cleaning up S3 emails directory..."
echo "Bucket: s3://$BUCKET/$PREFIX"

# List current files
echo "📋 Current files in emails directory:"
aws s3 ls "s3://$BUCKET/$PREFIX" --region "$REGION"

# Confirm deletion
read -p "❓ Are you sure you want to delete ALL files in s3://$BUCKET/$PREFIX? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️ Deleting all files..."
    aws s3 rm "s3://$BUCKET/$PREFIX" --recursive --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully cleaned up emails directory"
        echo "📋 Verify cleanup: aws s3 ls s3://$BUCKET/$PREFIX --region $REGION"
    else
        echo "❌ Failed to clean up emails directory"
        exit 1
    fi
else
    echo "🚫 Cleanup cancelled"
fi 