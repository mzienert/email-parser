/**
 * Logger utility for structured logging across Lambda functions
 * Updated: 2025-07-07 to force utilities layer rebuild
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_LEVEL_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

// Get log level from environment variable, default to INFO
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Create a structured log entry
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 * @param {string} functionName - Lambda function name
 * @returns {Object} Structured log entry
 */
function createLogEntry(level, message, metadata = {}, functionName = null) {
  return {
    timestamp: new Date().toISOString(),
    level,
    functionName: functionName || process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
    requestId: process.env.AWS_REQUEST_ID || 'unknown',
    message,
    ...metadata
  };
}

/**
 * Log function factory
 * @param {number} level - Log level number
 * @param {string} levelName - Log level name
 * @returns {Function} Log function
 */
function createLogFunction(level, levelName) {
  return (message, metadata = {}, functionName = null) => {
    if (level <= currentLogLevel) {
      const logEntry = createLogEntry(levelName, message, metadata, functionName);
      
      // Use appropriate console method based on level
      if (level === LOG_LEVELS.ERROR) {
        console.error(JSON.stringify(logEntry, null, 2));
      } else if (level === LOG_LEVELS.WARN) {
        console.warn(JSON.stringify(logEntry, null, 2));
      } else {
        console.log(JSON.stringify(logEntry, null, 2));
      }
    }
  };
}

// Create log functions for each level
const error = createLogFunction(LOG_LEVELS.ERROR, 'ERROR');
const warn = createLogFunction(LOG_LEVELS.WARN, 'WARN');
const info = createLogFunction(LOG_LEVELS.INFO, 'INFO');
const debug = createLogFunction(LOG_LEVELS.DEBUG, 'DEBUG');

/**
 * Log Lambda function start
 * @param {string} functionName - Function name
 * @param {Object} event - Lambda event
 */
function logFunctionStart(functionName, event) {
  info(`${functionName} started`, {
    eventType: event.Records ? 'S3' : event.pathParameters ? 'API Gateway' : 'Unknown',
    recordCount: event.Records?.length || 0
  }, functionName);
}

/**
 * Log Lambda function completion
 * @param {string} functionName - Function name
 * @param {number} duration - Execution duration in ms
 * @param {Object} result - Function result
 */
function logFunctionEnd(functionName, duration, result) {
  info(`${functionName} completed`, {
    duration: `${duration}ms`,
    success: true,
    resultType: typeof result
  }, functionName);
}

/**
 * Log Lambda function error
 * @param {string} functionName - Function name
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function logFunctionError(functionName, error, context = {}) {
  error(`${functionName} failed`, {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    ...context
  }, functionName);
}

/**
 * Log AWS service operation
 * @param {string} service - AWS service name (e.g., 'S3', 'EventBridge')
 * @param {string} operation - Operation name (e.g., 'GetObject', 'PutEvents')
 * @param {Object} params - Operation parameters
 * @param {string} status - Success or Error
 */
function logAwsOperation(service, operation, params, status = 'Success') {
  const level = status === 'Success' ? info : error;
  level(`AWS ${service} ${operation}`, {
    service,
    operation,
    status,
    params: {
      // Log safe parameters only (no sensitive data)
      bucket: params.Bucket,
      key: params.Key,
      eventBusName: params.EventBusName,
      tableName: params.TableName
    }
  });
}

module.exports = {
  error,
  warn,
  info,
  debug,
  logFunctionStart,
  logFunctionEnd,
  logFunctionError,
  logAwsOperation,
  LOG_LEVELS
}; 