#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EmailParsingStack } from '../lib/email-parsing-stack';

const app = new cdk.App();
new EmailParsingStack(app, 'EmailParsingStack', {
  /* Configure for us-west-1 region to match AWS credentials */
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: 'us-west-1' 
  },
  
  /* Email parsing system stack for government contracting */
  description: 'AI-Powered Government Email Parsing System - Event-driven AWS Infrastructure'
});