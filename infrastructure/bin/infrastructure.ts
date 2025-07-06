#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EmailParsingStack } from '../lib/email-parsing-stack';

const app = new cdk.App();
new EmailParsingStack(app, 'EmailParsingStack', {
  /* Configure for us-west-2 region to support Bedrock */
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: 'us-west-2' 
  },
  
  /* Email parsing system stack for government contracting */
  description: 'AI-Powered Government Email Parsing System - Event-driven AWS Infrastructure'
});