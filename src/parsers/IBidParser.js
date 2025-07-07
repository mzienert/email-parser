/**
 * IBidParser Interface
 * 
 * Defines the contract for all email parser implementations.
 * Each parser type (SEWP, NASA, Generic) must implement these methods.
 */
class IBidParser {
  constructor(bedrockClient) {
    if (this.constructor === IBidParser) {
      throw new Error('IBidParser is an interface and cannot be instantiated directly');
    }
    this.bedrockClient = bedrockClient;
  }

  /**
   * Extract structured bid data from email content
   * @param {Object} emailData - Email data from EventBridge event
   * @param {string} emailData.emailId - Unique email identifier
   * @param {string} emailData.subject - Email subject line
   * @param {string} emailData.from - Sender email address
   * @param {string} emailData.to - Recipient email address
   * @param {string} emailData.contentPreview - Email body content
   * @param {string} emailData.s3Key - S3 key for full email content
   * @returns {Promise<Object>} Structured bid data
   */
  async extractFields(emailData) {
    throw new Error('extractFields method must be implemented by subclass');
  }

  /**
   * Validate the quality of extracted data
   * @param {Object} extractedBid - The extracted bid data
   * @returns {Promise<Object>} Validation result with isValid flag and errors
   */
  async validateExtraction(extractedBid) {
    throw new Error('validateExtraction method must be implemented by subclass');
  }

  /**
   * Get parser-specific confidence score for handling this email
   * @param {Object} emailData - Email data to analyze
   * @returns {number} Confidence score (0-1, higher = more confident)
   */
  getConfidenceScore(emailData) {
    throw new Error('getConfidenceScore method must be implemented by subclass');
  }

  /**
   * Get parser type identifier
   * @returns {string} Parser type (e.g., 'SEWP', 'NASA', 'GENERIC')
   */
  getParserType() {
    throw new Error('getParserType method must be implemented by subclass');
  }
}

module.exports = IBidParser; 