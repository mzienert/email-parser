const IBidParser = require('../IBidParser');

/**
 * SEWPParser - Specialized parser for SEWP (Solutions for Enterprise-Wide Procurement) emails
 * 
 * Uses hybrid approach:
 * - Rule-based detection for SEWP-specific patterns
 * - Bedrock LLM for complex field extraction and validation
 */
class SEWPParser extends IBidParser {
  constructor(bedrockClient) {
    super(bedrockClient);
  }

  /**
   * Get parser type identifier
   * @returns {string} Parser type
   */
  getParserType() {
    return 'SEWP';
  }

  /**
   * Get confidence score for handling this email
   * @param {Object} emailData - Email data to analyze
   * @returns {number} Confidence score (0-1)
   */
  getConfidenceScore(emailData) {
    let score = 0;
    const subject = emailData.subject?.toLowerCase() || '';
    const from = emailData.from?.toLowerCase() || '';
    const content = emailData.contentPreview?.toLowerCase() || '';

    // Strong indicators for SEWP emails
    if (subject.includes('sewp v') || subject.includes('sewp 5')) score += 0.4;
    if (subject.includes('rfq') || subject.includes('request for quote')) score += 0.2;
    if (from.includes('nasa.gov') || from.includes('sewp')) score += 0.2;
    if (content.includes('sewp v request for quote')) score += 0.3;
    if (content.includes('machine readable section')) score += 0.3;
    if (content.includes('contract vehicle')) score += 0.1;
    if (content.includes('taa compliance') || content.includes('trade agreement')) score += 0.1;

    // Business certifications (common in SEWP)
    if (content.includes('hubzone') || content.includes('sdvosb') || content.includes('8(a)')) score += 0.1;

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Extract structured bid data from SEWP email
   * @param {Object} emailData - Email data from EventBridge event
   * @returns {Promise<Object>} Structured bid data
   */
  async extractFields(emailData) {
    try {
      // Step 1: Rule-based extraction for structured SEWP elements
      const ruleBasedData = this.extractRuleBasedFields(emailData);
      
      // Step 2: Bedrock extraction for complex/unstructured elements
      const bedrockData = await this.extractBedrockFields(emailData);
      
      // Step 3: Merge and prioritize data (rule-based takes precedence for structured fields)
      const mergedData = this.mergeExtractionResults(ruleBasedData, bedrockData);
      
      return {
        emailId: emailData.emailId,
        parserType: this.getParserType(),
        confidence: this.getConfidenceScore(emailData),
        extractedAt: new Date().toISOString(),
        ...mergedData
      };
    } catch (error) {
      throw new Error(`SEWPParser extraction failed: ${error.message}`);
    }
  }

  /**
   * Rule-based extraction for structured SEWP elements
   * @param {Object} emailData - Email data
   * @returns {Object} Rule-based extracted data
   */
  extractRuleBasedFields(emailData) {
    const content = emailData.contentPreview || '';
    const subject = emailData.subject || '';
    
    const extracted = {
      // Basic email metadata
      subject: subject,
      from: emailData.from,
      to: emailData.to,
      
      // Contract vehicle detection
      contractVehicle: 'SEWP V',
      
      // RFQ number extraction from subject
      rfqNumber: this.extractRFQNumber(subject),
      
      // Structured data extraction
      requirements: this.extractRequirements(content),
      businessTypes: this.extractBusinessTypes(content),
      complianceRequirements: this.extractComplianceRequirements(content),
      
      // Attachment references
      attachments: this.extractAttachmentReferences(content)
    };

    return extracted;
  }

  /**
   * Extract RFQ number from subject line
   * @param {string} subject - Email subject
   * @returns {string|null} RFQ number
   */
  extractRFQNumber(subject) {
    // Pattern: "RFQ #12345" or "RFQ #ABC-123"
    const rfqMatch = subject.match(/RFQ\s*#?\s*([A-Z0-9\-]+)/i);
    return rfqMatch ? rfqMatch[1] : null;
  }

  /**
   * Extract business type requirements
   * @param {string} content - Email content
   * @returns {Array} Business types
   */
  extractBusinessTypes(content) {
    const businessTypes = [];
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('hubzone')) businessTypes.push('HUBZone');
    if (contentLower.includes('sdvosb')) businessTypes.push('SDVOSB');
    if (contentLower.includes('8(a)') || contentLower.includes('eight(a)')) businessTypes.push('8(a)');
    if (contentLower.includes('wosb')) businessTypes.push('WOSB');
    if (contentLower.includes('vosb')) businessTypes.push('VOSB');
    
    return businessTypes;
  }

  /**
   * Extract compliance requirements
   * @param {string} content - Email content
   * @returns {Array} Compliance requirements
   */
  extractComplianceRequirements(content) {
    const compliance = [];
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('taa compliance') || contentLower.includes('trade agreement')) {
      compliance.push('TAA Compliant');
    }
    if (contentLower.includes('buy american')) {
      compliance.push('Buy American Act');
    }
    if (contentLower.includes('berry amendment')) {
      compliance.push('Berry Amendment');
    }
    
    return compliance;
  }

  /**
   * Extract technical requirements
   * @param {string} content - Email content
   * @returns {Array} Technical requirements
   */
  extractRequirements(content) {
    const requirements = [];
    
    // Look for bullet points or numbered lists
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[\-\*\d+\.\)]/)) {
        requirements.push(trimmed);
      }
    }
    
    return requirements;
  }

  /**
   * Extract attachment references
   * @param {string} content - Email content
   * @returns {Array} Attachment references
   */
  extractAttachmentReferences(content) {
    const attachments = [];
    const attachmentPattern = /attachment[s]?\s*\d*[:\-]?\s*([^\n]+)/gi;
    
    let match;
    while ((match = attachmentPattern.exec(content)) !== null) {
      attachments.push(match[1].trim());
    }
    
    return attachments;
  }

  /**
   * Use Bedrock to extract complex/unstructured elements
   * @param {Object} emailData - Email data
   * @returns {Promise<Object>} Bedrock extracted data
   */
  async extractBedrockFields(emailData) {
    // TODO: Implement Bedrock integration in next step
    // For now, return placeholder structure
    return {
      brandRestrictions: [],
      technicalSpecifications: [],
      deliveryRequirements: {},
      evaluationCriteria: [],
      bedrockConfidence: 0.0
    };
  }

  /**
   * Merge rule-based and Bedrock results
   * @param {Object} ruleBasedData - Rule-based extraction
   * @param {Object} bedrockData - Bedrock extraction
   * @returns {Object} Merged data
   */
  mergeExtractionResults(ruleBasedData, bedrockData) {
    return {
      ...bedrockData,
      ...ruleBasedData, // Rule-based takes precedence
      extractionMethod: 'hybrid'
    };
  }

  /**
   * Validate the quality of extracted data
   * @param {Object} extractedBid - The extracted bid data
   * @returns {Promise<Object>} Validation result
   */
  async validateExtraction(extractedBid) {
    const errors = [];
    const warnings = [];

    // Required fields validation
    if (!extractedBid.rfqNumber) {
      errors.push('RFQ number not found in subject line');
    }

    if (!extractedBid.requirements || extractedBid.requirements.length === 0) {
      warnings.push('No technical requirements extracted');
    }

    if (!extractedBid.complianceRequirements || extractedBid.complianceRequirements.length === 0) {
      warnings.push('No compliance requirements found');
    }

    // Confidence threshold validation
    if (extractedBid.confidence < 0.5) {
      warnings.push('Low confidence score for SEWP parser');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationScore: errors.length === 0 ? 1.0 : 0.5,
      recommendedAction: errors.length > 0 ? 'manual_review' : 'proceed'
    };
  }
}

module.exports = SEWPParser; 