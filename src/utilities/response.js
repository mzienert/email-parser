/**
 * Utility functions for standardized Lambda responses
 */

/**
 * Create a standardized success response
 * @param {string} message - Success message
 * @param {Object} data - Optional data payload
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Formatted Lambda response
 */
function successResponse(message, data = null, statusCode = 200) {
  const response = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
    },
    body: JSON.stringify({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    })
  };
  
  console.log('Success response:', response);
  return response;
}

/**
 * Create a standardized error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Object} error - Optional error details
 * @returns {Object} Formatted Lambda response
 */
function errorResponse(message, statusCode = 500, error = null) {
  const response = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
    },
    body: JSON.stringify({
      success: false,
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : null,
      timestamp: new Date().toISOString()
    })
  };
  
  console.error('Error response:', response);
  return response;
}

/**
 * Create a standardized response for async operations (like SQS/EventBridge triggers)
 * @param {string} message - Processing message
 * @param {Object} data - Optional processing data
 * @returns {Object} Formatted Lambda response
 */
function processingResponse(message, data = null) {
  return successResponse(message, data, 202);
}

module.exports = {
  successResponse,
  errorResponse,
  processingResponse
}; 