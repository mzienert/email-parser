const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

// Import our Strategy pattern implementation
const { SupplierMatcher } = require('/opt/nodejs/strategies/SupplierMatcher');

// Import utilities
const logger = require('/opt/nodejs/logger');
const { successResponse, errorResponse } = require('/opt/nodejs/response');

// Configure AWS SDK clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });
const eventBridgeClient = new EventBridgeClient({ region: process.env.AWS_REGION });

// Environment variables
const SUPPLIER_TABLE_NAME = process.env.SUPPLIER_TABLE_NAME;
const MATCH_HISTORY_TABLE_NAME = process.env.MATCH_HISTORY_TABLE_NAME;
const PROCESS_RESULTS_QUEUE_URL = process.env.PROCESS_RESULTS_QUEUE_URL;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;

/**
 * Supplier Matcher Lambda Handler
 * Processes parsed email data and matches suppliers using Strategy pattern
 */
exports.handler = async (event) => {
  const functionName = 'supplier-matcher';
  const startTime = Date.now();
  
  logger.logFunctionStart(functionName, {
    recordCount: event.Records?.length || 0,
    environment: {
      supplierTable: SUPPLIER_TABLE_NAME,
      matchHistoryTable: MATCH_HISTORY_TABLE_NAME,
      processResultsQueue: PROCESS_RESULTS_QUEUE_URL
    }
  });

  try {
    // Process each SQS record
    for (const record of event.Records) {
      const messageBody = JSON.parse(record.body);
      
      // Extract event data from EventBridge format
      let emailParsedEvent;
      if (messageBody.detail) {
        // EventBridge event format
        emailParsedEvent = messageBody.detail;
      } else {
        // Direct SQS message format
        emailParsedEvent = messageBody;
      }

      logger.info('Processing supplier matching request', {
        emailId: emailParsedEvent.emailId,
        messageId: record.messageId,
        parserType: emailParsedEvent.parserType
      });

      // Step 1: Retrieve all suppliers from DynamoDB
      const suppliers = await retrieveSuppliers();
      
      if (suppliers.length === 0) {
        logger.warn('No suppliers found in catalog', { emailId: emailParsedEvent.emailId });
        continue;
      }

      // Step 2: Initialize supplier matcher with Strategy pattern
      const supplierMatcher = new SupplierMatcher();
      
      // Step 3: Execute multi-strategy supplier matching
      const matchResults = await executeSupplierMatching(supplierMatcher, emailParsedEvent, suppliers);
      
      // Step 4: Filter and rank results
      const topMatches = await filterAndRankMatches(matchResults, emailParsedEvent);
      
      // Step 5: Store match results in DynamoDB
      await storeMatchResults(emailParsedEvent.emailId, topMatches, supplierMatcher.getMatchSummary(matchResults));
      
      // Step 6: Publish supplier matching events
      await publishSupplierMatchedEvents(emailParsedEvent, topMatches);
      
      // Step 7: Send to process results queue
      await sendToProcessQueue(emailParsedEvent, topMatches);

      logger.info('Supplier matching completed successfully', {
        emailId: emailParsedEvent.emailId,
        totalSuppliers: suppliers.length,
        topMatches: topMatches.length,
        bestScore: topMatches.length > 0 ? (topMatches[0].compositeScore * 100).toFixed(1) + '%' : 'N/A'
      });
    }

    const duration = Date.now() - startTime;
    const processedCount = event.Records.length;
    
    const result = successResponse('Supplier matching completed successfully', {
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

    return errorResponse('Failed to process supplier matching', 500, error);
  }
};

/**
 * Retrieve all active suppliers from DynamoDB
 * @returns {Promise<Array>} - Array of supplier records
 */
async function retrieveSuppliers() {
  try {
    const command = new ScanCommand({
      TableName: SUPPLIER_TABLE_NAME,
      FilterExpression: '#metadata.#status = :active',
      ExpressionAttributeNames: {
        '#metadata': 'metadata',
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':active': 'active'
      }
    });

    const response = await docClient.send(command);
    
    logger.info('Retrieved suppliers from catalog', {
      count: response.Items?.length || 0,
      tableName: SUPPLIER_TABLE_NAME
    });

    return response.Items || [];
    
  } catch (error) {
    logger.error('Failed to retrieve suppliers', { error: error.message });
    throw new Error(`Failed to retrieve suppliers: ${error.message}`);
  }
}

/**
 * Execute multi-strategy supplier matching
 * @param {SupplierMatcher} supplierMatcher - Configured supplier matcher
 * @param {Object} extractedBid - Parsed email bid data
 * @param {Array} suppliers - Array of supplier records
 * @returns {Promise<Array>} - Array of match results
 */
async function executeSupplierMatching(supplierMatcher, extractedBid, suppliers) {
  try {
    logger.info('Executing multi-strategy supplier matching', {
      strategies: supplierMatcher.getStrategies().map(s => s.getStrategyName()),
      supplierCount: suppliers.length,
      emailId: extractedBid.emailId
    });

    const matchResults = await supplierMatcher.matchSuppliers(extractedBid, suppliers);
    
    logger.info('Strategy pattern matching completed', {
      emailId: extractedBid.emailId,
      resultsCount: matchResults.length,
      avgScore: matchResults.length > 0 ? (matchResults.reduce((sum, r) => sum + r.compositeScore, 0) / matchResults.length * 100).toFixed(1) + '%' : 'N/A'
    });

    return matchResults;
    
  } catch (error) {
    logger.error('Strategy pattern matching failed', {
      emailId: extractedBid.emailId,
      error: error.message
    });
    throw new Error(`Supplier matching failed: ${error.message}`);
  }
}

/**
 * Filter and rank match results
 * @param {Array} matchResults - Raw match results
 * @param {Object} extractedBid - Parsed email bid data
 * @returns {Promise<Array>} - Filtered and ranked top matches
 */
async function filterAndRankMatches(matchResults, extractedBid) {
  try {
    // Filter by minimum score threshold (50%)
    const qualifiedMatches = matchResults.filter(result => result.compositeScore >= 0.5);
    
    // Take top 5 matches
    const topMatches = qualifiedMatches.slice(0, 5);
    
    logger.info('Filtered and ranked matches', {
      emailId: extractedBid.emailId,
      originalCount: matchResults.length,
      qualifiedCount: qualifiedMatches.length,
      topMatchesCount: topMatches.length,
      threshold: '50%'
    });

    return topMatches;
    
  } catch (error) {
    logger.error('Failed to filter and rank matches', {
      emailId: extractedBid.emailId,
      error: error.message
    });
    throw new Error(`Match filtering failed: ${error.message}`);
  }
}

/**
 * Store match results in DynamoDB match history table
 * @param {string} emailId - Email identifier
 * @param {Array} topMatches - Top supplier matches
 * @param {Object} matchSummary - Match summary statistics
 */
async function storeMatchResults(emailId, topMatches, matchSummary) {
  try {
    const matchId = `MATCH-${emailId}-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    const matchRecord = {
      matchId: matchId,
      emailId: emailId,
      timestamp: timestamp,
      matchCount: topMatches.length,
      topScore: topMatches.length > 0 ? topMatches[0].compositeScore : 0,
      averageScore: matchSummary.averageScore,
      matches: topMatches.map(match => ({
        supplierId: match.supplierId,
        companyName: match.companyName,
        compositeScore: match.compositeScore,
        confidence: match.confidence,
        complianceStatus: match.supplier.complianceStatus,
        state: match.supplier.geographicCapabilities?.state,
        businessCertifications: match.supplier.businessCertifications,
        strategyBreakdown: Object.fromEntries(
          Object.entries(match.strategyScores).map(([strategy, score]) => [
            strategy, 
            { score: score.score, confidence: score.confidence }
          ])
        )
      })),
      strategySummary: matchSummary.strategySummary,
      metadata: {
        processingTime: Date.now(),
        version: '1.0',
        strategyPattern: 'MultiStrategy'
      }
    };

    const command = new PutCommand({
      TableName: MATCH_HISTORY_TABLE_NAME,
      Item: matchRecord
    });

    await docClient.send(command);
    
    logger.info('Match results stored successfully', {
      matchId: matchId,
      emailId: emailId,
      matchCount: topMatches.length
    });
    
  } catch (error) {
    logger.error('Failed to store match results', {
      emailId: emailId,
      error: error.message
    });
    throw new Error(`Match storage failed: ${error.message}`);
  }
}

/**
 * Publish supplier matched events to EventBridge
 * @param {Object} extractedBid - Parsed email bid data
 * @param {Array} topMatches - Top supplier matches
 */
async function publishSupplierMatchedEvents(extractedBid, topMatches) {
  try {
    const events = [];
    
    // Main supplier matching event
    events.push({
      Source: 'email.processing',
      DetailType: 'Suppliers Matched',
      Detail: JSON.stringify({
        emailId: extractedBid.emailId,
        matchCount: topMatches.length,
        topScore: topMatches.length > 0 ? topMatches[0].compositeScore : 0,
        bestMatch: topMatches.length > 0 ? {
          supplierId: topMatches[0].supplierId,
          companyName: topMatches[0].companyName,
          score: topMatches[0].compositeScore
        } : null,
        processingTimestamp: new Date().toISOString()
      })
    });

    // Individual supplier match events for top 3
    const top3 = topMatches.slice(0, 3);
    for (const match of top3) {
      events.push({
        Source: 'email.processing',
        DetailType: 'Supplier Match Found',
        Detail: JSON.stringify({
          emailId: extractedBid.emailId,
          supplierId: match.supplierId,
          companyName: match.companyName,
          compositeScore: match.compositeScore,
          confidence: match.confidence,
          complianceStatus: match.supplier.complianceStatus,
          rank: top3.indexOf(match) + 1,
          processingTimestamp: new Date().toISOString()
        })
      });
    }

    if (events.length > 0) {
      const command = new PutEventsCommand({
        Entries: events.map(event => ({
          ...event,
          EventBusName: EVENT_BUS_NAME
        }))
      });

      await eventBridgeClient.send(command);
      
      logger.info('Supplier match events published', {
        emailId: extractedBid.emailId,
        eventCount: events.length
      });
    }
    
  } catch (error) {
    logger.warn('Failed to publish supplier match events', {
      emailId: extractedBid.emailId,
      error: error.message
    });
    // Don't throw - this is not critical for the main workflow
  }
}

/**
 * Send results to process queue for next stage
 * @param {Object} extractedBid - Parsed email bid data
 * @param {Array} topMatches - Top supplier matches
 */
async function sendToProcessQueue(extractedBid, topMatches) {
  try {
    const message = {
      emailId: extractedBid.emailId,
      stage: 'supplier_matching_complete',
      matchCount: topMatches.length,
      topMatches: topMatches.map(match => match.getSummary()),
      processingTimestamp: new Date().toISOString(),
      nextStage: 'result_processing'
    };

    const command = new SendMessageCommand({
      QueueUrl: PROCESS_RESULTS_QUEUE_URL,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        emailId: {
          DataType: 'String',
          StringValue: extractedBid.emailId
        },
        stage: {
          DataType: 'String',
          StringValue: 'supplier_matching_complete'
        }
      }
    });

    await sqsClient.send(command);
    
    logger.info('Results sent to process queue', {
      emailId: extractedBid.emailId,
      queueUrl: PROCESS_RESULTS_QUEUE_URL,
      matchCount: topMatches.length
    });
    
  } catch (error) {
    logger.error('Failed to send to process queue', {
      emailId: extractedBid.emailId,
      error: error.message
    });
    throw new Error(`Process queue send failed: ${error.message}`);
  }
} 