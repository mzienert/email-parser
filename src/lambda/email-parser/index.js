const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const { successResponse, errorResponse } = require('/opt/nodejs/response');
const logger = require('/opt/nodejs/logger');
const BidParserFactory = require('./BidParserFactory');

// Initialize AWS clients
const bedrockClient = new BedrockRuntimeClient({ 
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION 
});
const eventBridge = new EventBridgeClient({ 
  region: process.env.AWS_REGION 
});

exports.handler = async (event) => {
  const functionName = 'EmailParser';
  const startTime = Date.now();
  
  logger.logFunctionStart(functionName, event);

  try {
    // Process each SQS record
    for (const record of event.Records) {
      const messageBody = JSON.parse(record.body);
      
      // EventBridge events come wrapped in the SQS message body
      const eventBridgeEvent = messageBody;
      const emailData = eventBridgeEvent.detail;
      
      logger.info('Processing email for parsing', {
        emailId: emailData.emailId,
        subject: emailData.subject,
        eventSource: eventBridgeEvent.source,
        eventDetailType: eventBridgeEvent['detail-type']
      });

      // Step 1: Create appropriate parser using Factory pattern
      const parser = BidParserFactory.createParser(emailData, bedrockClient);
      
      logger.info('Parser selected', {
        emailId: emailData.emailId,
        parserType: parser.getParserType(),
        confidence: parser.getConfidenceScore(emailData)
      });

      // Step 2: Extract structured data
      const extractedBid = await parser.extractFields(emailData);
      
      logger.info('Email parsed successfully', {
        emailId: emailData.emailId,
        parserType: extractedBid.parserType,
        confidence: extractedBid.confidence,
        extractedFields: Object.keys(extractedBid).filter(key => 
          !['emailId', 'parserType', 'confidence', 'extractedAt'].includes(key)
        )
      });

      // Step 3: Validate extraction quality
      const validation = await parser.validateExtraction(extractedBid);
      
      logger.info('Extraction validation completed', {
        emailId: emailData.emailId,
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        recommendedAction: validation.recommendedAction
      });

      // Step 4: Handle validation results
      if (!validation.isValid) {
        logger.warn('Extraction validation failed', {
          emailId: emailData.emailId,
          errors: validation.errors
        });
        
        // For now, continue processing even with validation errors
        // In production, might send to DLQ or trigger manual review
      }

      // Step 5: Store extracted data (TODO: DynamoDB integration)
      await storeExtractedBid(extractedBid, validation);

      // Step 6: Publish "Email Parsed" event for supplier matching
      await publishEmailParsedEvent(extractedBid, validation);

      logger.info('Email processing completed', {
        emailId: emailData.emailId,
        parserType: extractedBid.parserType,
        validationStatus: validation.isValid ? 'valid' : 'invalid',
        nextStep: 'supplier_matching'
      });
    }

    const duration = Date.now() - startTime;
    const processedCount = event.Records.length;
    
    const result = successResponse('Email(s) parsed successfully', { 
      processedCount,
      duration: `${duration}ms`
    });
    
    logger.logFunctionEnd(functionName, duration, result);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.logFunctionError(functionName, error, { 
      recordCount: event.Records?.length || 0,
      duration: `${duration}ms`
    });

    return errorResponse('Failed to parse email(s)', 500, error);
  }
};

/**
 * Store extracted bid data in DynamoDB
 * @param {Object} extractedBid - Extracted bid data
 * @param {Object} validation - Validation results
 */
async function storeExtractedBid(extractedBid, validation) {
  // TODO: Implement DynamoDB storage
  logger.info('Storing extracted bid data', {
    emailId: extractedBid.emailId,
    parserType: extractedBid.parserType,
    validationStatus: validation.isValid ? 'valid' : 'invalid'
  });
  
  // Placeholder for DynamoDB put operation
  logger.debug('DynamoDB storage placeholder', {
    tableName: process.env.EMAIL_TABLE_NAME,
    emailId: extractedBid.emailId
  });
}

/**
 * Publish "Email Parsed" event to EventBridge
 * @param {Object} extractedBid - Extracted bid data
 * @param {Object} validation - Validation results
 */
async function publishEmailParsedEvent(extractedBid, validation) {
  const eventDetail = {
    emailId: extractedBid.emailId,
    parserType: extractedBid.parserType,
    confidence: extractedBid.confidence,
    contractVehicle: extractedBid.contractVehicle,
    rfqNumber: extractedBid.rfqNumber,
    validationStatus: validation.isValid ? 'valid' : 'invalid',
    requiresManualReview: validation.recommendedAction === 'manual_review',
    extractedAt: extractedBid.extractedAt,
    
    // Include key extracted fields for supplier matching
    businessTypes: extractedBid.businessTypes || [],
    complianceRequirements: extractedBid.complianceRequirements || [],
    requirements: extractedBid.requirements ? extractedBid.requirements.slice(0, 5) : [] // First 5 requirements
  };

  const command = new PutEventsCommand({
    Entries: [
      {
        Source: 'email.processing',
        DetailType: 'Email Parsed',
        Detail: JSON.stringify(eventDetail),
        EventBusName: process.env.EVENT_BUS_NAME
      }
    ]
  });

  logger.info('Publishing EmailParsed event', {
    emailId: extractedBid.emailId,
    parserType: extractedBid.parserType,
    eventBusName: process.env.EVENT_BUS_NAME
  });

  const response = await eventBridge.send(command);
  
  logger.info('EmailParsed event published', {
    emailId: extractedBid.emailId,
    eventId: response.Entries[0].EventId,
    status: 'Success'
  });
} 