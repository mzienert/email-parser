const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('/opt/nodejs/logger');
const { successResponse, errorResponse } = require('/opt/nodejs/response');

// Configure AWS SDK clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Environment variables
const EMAIL_TABLE_NAME = process.env.EMAIL_TABLE_NAME;
const SUPPLIER_TABLE_NAME = process.env.SUPPLIER_TABLE_NAME;
const MATCH_HISTORY_TABLE_NAME = process.env.MATCH_HISTORY_TABLE_NAME;

/**
 * API Gateway Lambda Handler
 * Handles REST API endpoints for frontend integration
 */
exports.handler = async (event) => {
  const functionName = 'api-handler';
  const startTime = Date.now();
  
  logger.logFunctionStart(functionName, {
    httpMethod: event.httpMethod,
    path: event.path,
    resource: event.resource,
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters
  });

  try {
    // Route requests based on HTTP method and path
    const { httpMethod, resource, pathParameters, queryStringParameters } = event;
    
    switch (resource) {
      case '/suppliers/suggest':
        if (httpMethod === 'POST') {
          return await handleSupplierSuggest(event);
        }
        break;
        
      case '/emails/{id}/matches':
        if (httpMethod === 'GET') {
          return await handleEmailMatches(event);
        }
        break;
        
      case '/suppliers/feedback':
        if (httpMethod === 'POST') {
          return await handleSupplierFeedback(event);
        }
        break;
        
      default:
        return errorResponse(`Unsupported route: ${httpMethod} ${resource}`, 404);
    }
    
    return errorResponse(`Method ${httpMethod} not allowed for ${resource}`, 405);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.logFunctionError(functionName, error, {
      httpMethod: event.httpMethod,
      path: event.path,
      duration: `${duration}ms`
    });

    return errorResponse('Internal server error', 500, error);
  }
};

/**
 * POST /suppliers/suggest
 * Provides intelligent supplier suggestions based on item requirements
 */
async function handleSupplierSuggest(event) {
  const functionName = 'supplier-suggest';
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { items, requirements, preferences } = body;
    
    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('Items array is required and must not be empty', 400);
    }
    
    logger.info('Processing supplier suggestion request', {
      itemCount: items.length,
      requirements: requirements || {},
      preferences: preferences || {}
    });
    
    // Get all active suppliers
    const suppliers = await retrieveActiveSuppliers();
    
    if (suppliers.length === 0) {
      return successResponse('No suppliers available', { suggestions: [] });
    }
    
    // Score suppliers based on requirements
    const scoredSuppliers = await scoreSuppliers(suppliers, items, requirements, preferences);
    
    // Return top suggestions
    const suggestions = scoredSuppliers
      .filter(supplier => supplier.score >= 0.1) // 10% threshold (more lenient for testing)
      .slice(0, 10) // Top 10 suggestions
      .map(supplier => ({
        supplierId: supplier.supplierId,
        companyName: supplier.companyName,
        score: supplier.score,
        confidence: supplier.confidence,
        capabilities: supplier.technicalCapabilities || [],
        complianceStatus: supplier.complianceStatus || {},
        businessCertifications: supplier.businessCertifications || [],
        contactInfo: supplier.contactInfo || {},
        matchReasons: supplier.matchReasons || []
      }));
    
    const duration = Date.now() - startTime;
    
    logger.info('Supplier suggestions generated', {
      totalSuppliers: suppliers.length,
      qualifiedSuggestions: suggestions.length,
      bestScore: suggestions.length > 0 ? suggestions[0].score : 0,
      duration: `${duration}ms`
    });
    
    return successResponse('Supplier suggestions generated successfully', {
      suggestions,
      totalEvaluated: suppliers.length,
      metadata: {
        generatedAt: new Date().toISOString(),
        threshold: 0.1,
        duration: `${duration}ms`
      }
    });
    
  } catch (error) {
    logger.error('Failed to generate supplier suggestions', { error: error.message });
    return errorResponse('Failed to generate supplier suggestions', 500, error);
  }
}

/**
 * GET /emails/{id}/matches
 * Returns supplier match results for a specific email
 */
async function handleEmailMatches(event) {
  const functionName = 'email-matches';
  const startTime = Date.now();
  
  try {
    const emailId = event.pathParameters?.id;
    
    if (!emailId) {
      return errorResponse('Email ID is required', 400);
    }
    
    logger.info('Retrieving email matches', { emailId });
    
    // Get match history for this email
    const matchHistory = await getMatchHistory(emailId);
    
    if (!matchHistory || matchHistory.length === 0) {
      return successResponse('No matches found for this email', {
        email: { emailId },
        matches: [],
        matchCount: 0
      });
    }
    
    // Get the most recent match results
    const latestMatch = matchHistory[0]; // Assuming sorted by timestamp desc
    
    // Enhance match results with current supplier data
    const enhancedMatches = await enhanceMatchResults(latestMatch.matches);
    
    const duration = Date.now() - startTime;
    
    logger.info('Email matches retrieved', {
      emailId,
      matchCount: enhancedMatches.length,
      bestScore: enhancedMatches.length > 0 ? enhancedMatches[0].compositeScore : 0,
      duration: `${duration}ms`
    });
    
    return successResponse('Email matches retrieved successfully', {
      email: { emailId },
      matches: enhancedMatches,
      matchCount: enhancedMatches.length,
      matchSummary: {
        averageScore: latestMatch.averageScore,
        topScore: latestMatch.topScore,
        strategySummary: latestMatch.strategySummary,
        processingTime: latestMatch.timestamp
      },
      metadata: {
        retrievedAt: new Date().toISOString(),
        duration: `${duration}ms`
      }
    });
    
  } catch (error) {
    logger.error('Failed to retrieve email matches', { 
      emailId: event.pathParameters?.id,
      error: error.message 
    });
    return errorResponse('Failed to retrieve email matches', 500, error);
  }
}

/**
 * POST /suppliers/feedback
 * Collects feedback on supplier match quality for system improvement
 */
async function handleSupplierFeedback(event) {
  const functionName = 'supplier-feedback';
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { emailId, supplierId, feedback, rating, comments } = body;
    
    // Validate required fields
    if (!emailId || !supplierId || !feedback) {
      return errorResponse('emailId, supplierId, and feedback are required', 400);
    }
    
    if (rating && (rating < 1 || rating > 5)) {
      return errorResponse('Rating must be between 1 and 5', 400);
    }
    
    logger.info('Processing supplier feedback', {
      emailId,
      supplierId,
      feedback,
      rating: rating || 'not provided'
    });
    
    // Store feedback in DynamoDB
    const feedbackId = `FEEDBACK-${emailId}-${supplierId}-${Date.now()}`;
    
    const feedbackRecord = {
      feedbackId,
      emailId,
      supplierId,
      feedback,
      rating: rating || null,
      comments: comments || null,
      timestamp: new Date().toISOString(),
      metadata: {
        userAgent: event.headers?.['User-Agent'] || 'unknown',
        ipAddress: event.requestContext?.identity?.sourceIp || 'unknown',
        processingTime: Date.now()
      }
    };
    
    await storeFeedback(feedbackRecord);
    
    const duration = Date.now() - startTime;
    
    logger.info('Supplier feedback stored', {
      feedbackId,
      emailId,
      supplierId,
      duration: `${duration}ms`
    });
    
    return successResponse('Feedback submitted successfully', {
      feedbackId,
      status: 'stored',
      metadata: {
        submittedAt: new Date().toISOString(),
        duration: `${duration}ms`
      }
    });
    
  } catch (error) {
    logger.error('Failed to process supplier feedback', { error: error.message });
    return errorResponse('Failed to process supplier feedback', 500, error);
  }
}

/**
 * Helper Functions
 */

async function retrieveActiveSuppliers() {
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
  return response.Items || [];
}

async function scoreSuppliers(suppliers, items, requirements, preferences) {
  // Simplified scoring algorithm for API suggestions
  return suppliers.map(supplier => {
    let score = 0;
    const matchReasons = [];
    
    // Technical capability matching
    const itemNames = items.map(item => item.name?.toLowerCase() || '');
    const supplierCapabilities = Array.isArray(supplier.technicalCapabilities) ? supplier.technicalCapabilities : [];
    
    for (const capability of supplierCapabilities) {
      for (const itemName of itemNames) {
        if (itemName.includes(capability.toLowerCase())) {
          score += 0.3;
          matchReasons.push(`Technical capability: ${capability}`);
        }
      }
    }
    
    // Compliance matching
    if (requirements?.taaCompliant && supplier.complianceStatus?.TAA) {
      score += 0.2;
      matchReasons.push('TAA Compliant');
    }
    
    // Business certification matching
    if (requirements?.businessCertifications && Array.isArray(supplier.businessCertifications)) {
      const matchedCerts = requirements.businessCertifications.filter(cert => 
        supplier.businessCertifications.includes(cert)
      );
      score += matchedCerts.length * 0.1;
      matchReasons.push(...matchedCerts.map(cert => `Business certification: ${cert}`));
    }
    
    // Geographic preference
    if (preferences?.state && supplier.geographicCapabilities?.state === preferences.state) {
      score += 0.15;
      matchReasons.push(`Geographic match: ${preferences.state}`);
    }
    
    // Normalize score
    score = Math.min(score, 1.0);
    
    return {
      ...supplier,
      score,
      confidence: score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low',
      matchReasons
    };
  }).sort((a, b) => b.score - a.score);
}

// getEmailDetails function removed - we're working directly with match history data

async function getMatchHistory(emailId) {
  // Since emailId is the sort key, we need to scan or use a GSI
  // For now, let's use scan with a filter expression
  const command = new ScanCommand({
    TableName: MATCH_HISTORY_TABLE_NAME,
    FilterExpression: 'emailId = :emailId AND attribute_not_exists(#recordType)',
    ExpressionAttributeNames: {
      '#recordType': 'metadata.recordType'
    },
    ExpressionAttributeValues: {
      ':emailId': emailId
    },
    Limit: 5
  });

  const response = await docClient.send(command);
  
  // Sort by timestamp descending
  const sortedItems = (response.Items || []).sort((a, b) => {
    const aTime = a.timestamp || a.processingTime || '0';
    const bTime = b.timestamp || b.processingTime || '0';
    return bTime.localeCompare(aTime);
  });
  
  return sortedItems;
}

async function enhanceMatchResults(matches) {
  // For now, return matches as-is
  // In production, could fetch current supplier data to ensure freshness
  return matches || [];
}

async function storeFeedback(feedbackRecord) {
  // Use the correct table structure with matchId as partition key
  const feedbackItem = {
    matchId: feedbackRecord.feedbackId, // Use feedbackId as matchId
    emailId: feedbackRecord.emailId,
    supplierId: feedbackRecord.supplierId,
    feedback: feedbackRecord.feedback,
    rating: feedbackRecord.rating,
    comments: feedbackRecord.comments,
    timestamp: feedbackRecord.timestamp,
    metadata: {
      ...feedbackRecord.metadata,
      recordType: 'feedback'
    }
  };

  const command = new PutCommand({
    TableName: MATCH_HISTORY_TABLE_NAME,
    Item: feedbackItem
  });

  await docClient.send(command);
} 