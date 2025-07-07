const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const { successResponse, errorResponse, processingResponse } = require('../../utilities/response');
const logger = require('../../utilities/logger');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  const functionName = 'EmailProcessor';
  const startTime = Date.now();
  
  logger.logFunctionStart(functionName, event);
  
  try {
    // Process each S3 record
    for (const record of event.Records) {
      if (record.eventName === 'ObjectCreated:Put') {
        const bucket = record.s3.bucket.name;
        const key = record.s3.object.key;
        
        logger.info('Processing S3 object', { bucket, key });
        
        // Only process .eml files in the emails/ prefix
        if (key.startsWith('emails/') && key.endsWith('.eml')) {
          const emailData = await processEmailFile(bucket, key);
          
          // Publish email received event to EventBridge
          await publishEmailReceivedEvent(emailData);
          
          logger.info('Successfully processed email', { 
            emailId: emailData.emailId, 
            subject: emailData.subject 
          });
        } else {
          logger.debug('Skipping non-email file', { key });
        }
      }
    }
    
    const duration = Date.now() - startTime;
    const processedCount = event.Records.filter(record => 
      record.s3.object.key.startsWith('emails/') && 
      record.s3.object.key.endsWith('.eml')
    ).length;
    
    const result = processingResponse('Email(s) processed successfully', { processedCount });
    
    logger.logFunctionEnd(functionName, duration, result);
    
    return result;
  } catch (error) {
    logger.logFunctionError(functionName, error, { 
      recordCount: event.Records?.length || 0 
    });

    return errorResponse('Failed to process email(s)', 500, error);
  }
};

async function processEmailFile(bucket, key) {
  // Download .eml file from S3
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  logger.logAwsOperation('S3', 'GetObject', { Bucket: bucket, Key: key });
  const response = await s3.send(command);
  
  // Convert stream to string
  const emailContent = await streamToString(response.Body);
  
  // Parse .eml file for basic metadata
  const emailData = parseEmailMetadata(emailContent, key);
  
  return emailData;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function parseEmailMetadata(emailContent, key) {
  const lines = emailContent.split('\n');
  const headers = {};
  let bodyStart = 0;
  
  // Parse email headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      bodyStart = i + 1;
      break;
    }
    
    const headerMatch = line.match(/^([^:]+):\s*(.*)$/);
    if (headerMatch) {
      const [, name, value] = headerMatch;
      headers[name.toLowerCase()] = value;
    }
  }
  
  // Extract email body
  const body = lines.slice(bodyStart).join('\n');
  
  // Generate email ID from S3 key
  const emailId = key.replace('emails/', '').replace('.eml', '');
  
  return {
    emailId,
    s3Key: key,
    headers,
    body: body.trim(),
    subject: headers.subject || 'No Subject',
    from: headers.from || 'Unknown Sender',
    to: headers.to || 'Unknown Recipient',
    date: headers.date || new Date().toISOString(),
    timestamp: new Date().toISOString()
  };
}

async function publishEmailReceivedEvent(emailData) {
  const eventDetail = {
    emailId: emailData.emailId,
    s3Key: emailData.s3Key,
    subject: emailData.subject,
    from: emailData.from,
    to: emailData.to,
    timestamp: emailData.timestamp,
    contentPreview: emailData.body.substring(0, 200) + '...'
  };
  
  const command = new PutEventsCommand({
    Entries: [
      {
        Source: 'email.processing',
        DetailType: 'Email Received',
        Detail: JSON.stringify(eventDetail),
        EventBusName: process.env.EVENT_BUS_NAME
      }
    ]
  });
  
  logger.info('Publishing EventBridge event', { eventDetail });
  logger.logAwsOperation('EventBridge', 'PutEvents', { EventBusName: process.env.EVENT_BUS_NAME });
  
  const result = await eventBridge.send(command);
  logger.info('EventBridge event published', { 
    eventId: result.Entries?.[0]?.EventId,
    status: result.Entries?.[0]?.ErrorCode ? 'Failed' : 'Success'
  });
  
  return result;
} 