const IBidParser = require('./IBidParser');

/**
 * GenericParser - Fallback parser for unstructured government procurement emails
 * 
 * Uses hybrid approach with emphasis on Bedrock:
 * - Basic rule-based patterns for common government terminology
 * - Heavy reliance on Bedrock LLM for unstructured content extraction
 * - Handles various government agencies and contract types
 */
class GenericParser extends IBidParser {
  constructor(bedrockClient) {
    super(bedrockClient);
  }

  /**
   * Get parser type identifier
   * @returns {string} Parser type
   */
  getParserType() {
    return 'GENERIC';
  }

  /**
   * Get confidence score for handling this email
   * @param {Object} emailData - Email data to analyze
   * @returns {number} Confidence score (0-1)
   */
  getConfidenceScore(emailData) {
    let score = 0.1; // Base score for generic parser (fallback)
    
    const subject = emailData.subject?.toLowerCase() || '';
    const from = emailData.from?.toLowerCase() || '';
    const content = emailData.contentPreview?.toLowerCase() || '';

    // General government indicators
    if (from.includes('.gov')) score += 0.2;
    if (subject.includes('rfp') || subject.includes('rfi') || subject.includes('rfq')) score += 0.2;
    if (subject.includes('request for')) score += 0.2;
    
    // Government agency indicators
    if (from.includes('gsa.gov') || content.includes('gsa')) score += 0.2;
    if (from.includes('dod.gov') || content.includes('department of defense')) score += 0.2;
    if (content.includes('federal') || content.includes('government')) score += 0.1;
    
    // Generic procurement terminology
    if (content.includes('procurement') || content.includes('solicitation')) score += 0.1;
    if (content.includes('contract') || content.includes('vendor')) score += 0.1;
    if (content.includes('proposal') || content.includes('quotation')) score += 0.1;
    
    // Reduce score if other parsers would handle better
    if (from.includes('nasa.gov') || content.includes('sewp')) score *= 0.5;

    return Math.min(score, 0.8); // Cap generic parser at 0.8 to favor specialized parsers
  }

  /**
   * Extract structured bid data from generic email
   * @param {Object} emailData - Email data from EventBridge event
   * @returns {Promise<Object>} Structured bid data
   */
  async extractFields(emailData) {
    try {
      // Step 1: Basic rule-based extraction
      const ruleBasedData = this.extractRuleBasedFields(emailData);
      
      // Step 2: Bedrock extraction (more important for generic parser)
      const bedrockData = await this.extractBedrockFields(emailData);
      
      // Step 3: Merge with Bedrock taking higher precedence for unstructured content
      const mergedData = this.mergeExtractionResults(ruleBasedData, bedrockData);
      
      return {
        emailId: emailData.emailId,
        parserType: this.getParserType(),
        confidence: this.getConfidenceScore(emailData),
        extractedAt: new Date().toISOString(),
        ...mergedData
      };
    } catch (error) {
      throw new Error(`GenericParser extraction failed: ${error.message}`);
    }
  }

  /**
   * Basic rule-based extraction for common patterns
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
      
      // Contract information
      contractVehicle: this.detectContractVehicle(content, subject),
      procurementType: this.detectProcurementType(subject, content),
      agency: this.detectAgency(emailData.from, content),
      
      // Basic identifiers
      solicitorationNumber: this.extractSolicitationNumber(subject, content),
      dueDate: this.extractDueDate(content),
      
      // Requirements
      basicRequirements: this.extractBasicRequirements(content),
      businessRequirements: this.extractBusinessRequirements(content),
      
      // Contact information
      contactInfo: this.extractContactInfo(content),
      
      // Attachments
      attachments: this.extractAttachmentReferences(content)
    };

    return extracted;
  }

  /**
   * Detect contract vehicle or program
   * @param {string} content - Email content
   * @param {string} subject - Email subject
   * @returns {string} Contract vehicle
   */
  detectContractVehicle(content, subject) {
    const combinedText = (content + ' ' + subject).toLowerCase();
    
    if (combinedText.includes('gsa schedules') || combinedText.includes('gsa schedule')) return 'GSA Schedule';
    if (combinedText.includes('sewp')) return 'SEWP';
    if (combinedText.includes('cio-sp3')) return 'CIO-SP3';
    if (combinedText.includes('oasis')) return 'OASIS';
    if (combinedText.includes('alliant 2')) return 'Alliant 2';
    if (combinedText.includes('8(a) stars')) return '8(a) STARS';
    
    return 'Government Direct';
  }

  /**
   * Detect procurement type
   * @param {string} subject - Email subject
   * @param {string} content - Email content
   * @returns {string} Procurement type
   */
  detectProcurementType(subject, content) {
    const combinedText = (subject + ' ' + content).toLowerCase();
    
    if (combinedText.includes('request for proposal') || combinedText.includes('rfp')) return 'RFP';
    if (combinedText.includes('request for quote') || combinedText.includes('rfq')) return 'RFQ';
    if (combinedText.includes('request for information') || combinedText.includes('rfi')) return 'RFI';
    if (combinedText.includes('invitation for bid') || combinedText.includes('ifb')) return 'IFB';
    if (combinedText.includes('broad agency announcement') || combinedText.includes('baa')) return 'BAA';
    
    return 'General Procurement';
  }

  /**
   * Detect government agency
   * @param {string} from - From email address
   * @param {string} content - Email content
   * @returns {string|null} Agency name
   */
  detectAgency(from, content) {
    const fromLower = (from || '').toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Common agency domains
    if (fromLower.includes('gsa.gov')) return 'General Services Administration (GSA)';
    if (fromLower.includes('nasa.gov')) return 'National Aeronautics and Space Administration (NASA)';
    if (fromLower.includes('dod.gov') || fromLower.includes('army.mil') || 
        fromLower.includes('navy.mil') || fromLower.includes('af.mil')) return 'Department of Defense (DoD)';
    if (fromLower.includes('dhs.gov')) return 'Department of Homeland Security (DHS)';
    if (fromLower.includes('va.gov')) return 'Department of Veterans Affairs (VA)';
    if (fromLower.includes('hhs.gov')) return 'Department of Health and Human Services (HHS)';
    if (fromLower.includes('treasury.gov')) return 'Department of Treasury';
    if (fromLower.includes('energy.gov')) return 'Department of Energy (DOE)';
    
    // Agency mentions in content
    if (contentLower.includes('department of defense')) return 'Department of Defense (DoD)';
    if (contentLower.includes('homeland security')) return 'Department of Homeland Security (DHS)';
    if (contentLower.includes('veterans affairs')) return 'Department of Veterans Affairs (VA)';
    
    return null;
  }

  /**
   * Extract solicitation number
   * @param {string} subject - Email subject
   * @param {string} content - Email content
   * @returns {string|null} Solicitation number
   */
  extractSolicitationNumber(subject, content) {
    // Try various patterns
    let match = subject.match(/(?:solicitation|rfp|rfq|rfi)\s*#?\s*([A-Z0-9\-\_]+)/i);
    if (match) return match[1];
    
    match = content.match(/solicitation\s*(?:number|#)?\s*:?\s*([A-Z0-9\-\_]+)/i);
    if (match) return match[1];
    
    match = content.match(/(?:reference|ref)\s*(?:number|#)?\s*:?\s*([A-Z0-9\-\_]+)/i);
    if (match) return match[1];
    
    return null;
  }

  /**
   * Extract due date
   * @param {string} content - Email content
   * @returns {string|null} Due date
   */
  extractDueDate(content) {
    // Common due date patterns
    let match = content.match(/due\s+(?:date|by)?\s*:?\s*([^\n]+)/i);
    if (match) return match[1].trim();
    
    match = content.match(/proposal\s+(?:must\s+)?(?:be\s+)?(?:submitted\s+)?(?:by|due)\s*:?\s*([^\n]+)/i);
    if (match) return match[1].trim();
    
    match = content.match(/deadline\s*:?\s*([^\n]+)/i);
    if (match) return match[1].trim();
    
    return null;
  }

  /**
   * Extract basic requirements
   * @param {string} content - Email content
   * @returns {Array} Basic requirements
   */
  extractBasicRequirements(content) {
    const requirements = [];
    
    // Look for requirement sections
    const lines = content.split('\n');
    let inRequirementSection = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if we're entering a requirements section
      if (trimmed.toLowerCase().includes('requirement') || 
          trimmed.toLowerCase().includes('specification') ||
          trimmed.toLowerCase().includes('scope of work')) {
        inRequirementSection = true;
        continue;
      }
      
      // If in requirements section, capture bullet points
      if (inRequirementSection && trimmed.match(/^[\-\*\d+\.\)]/)) {
        requirements.push(trimmed);
      }
      
      // Exit requirements section on blank line or new section
      if (inRequirementSection && trimmed === '') {
        inRequirementSection = false;
      }
    }
    
    return requirements;
  }

  /**
   * Extract business requirements
   * @param {string} content - Email content
   * @returns {Array} Business requirements
   */
  extractBusinessRequirements(content) {
    const requirements = [];
    const contentLower = content.toLowerCase();
    
    // Common business certifications
    if (contentLower.includes('small business')) requirements.push('Small Business');
    if (contentLower.includes('sdb') || contentLower.includes('small disadvantaged business')) requirements.push('Small Disadvantaged Business (SDB)');
    if (contentLower.includes('wosb') || contentLower.includes('women-owned small business')) requirements.push('Women-Owned Small Business (WOSB)');
    if (contentLower.includes('hubzone')) requirements.push('HUBZone Certified');
    if (contentLower.includes('8(a)')) requirements.push('8(a) Business Development');
    if (contentLower.includes('sdvosb') || contentLower.includes('service-disabled veteran')) requirements.push('Service-Disabled Veteran-Owned Small Business (SDVOSB)');
    
    return requirements;
  }

  /**
   * Extract contact information
   * @param {string} content - Email content
   * @returns {Object} Contact information
   */
  extractContactInfo(content) {
    const contact = {};
    
    // Extract contracting officer
    let match = content.match(/contracting\s+officer\s*:?\s*([^\n]+)/i);
    if (match) contact.contractingOfficer = match[1].trim();
    
    // Extract point of contact
    match = content.match(/(?:point\s+of\s+contact|poc)\s*:?\s*([^\n]+)/i);
    if (match) contact.pointOfContact = match[1].trim();
    
    // Extract phone numbers
    match = content.match(/(?:phone|tel|telephone)\s*:?\s*([0-9\-\(\)\s\+]+)/i);
    if (match) contact.phone = match[1].trim();
    
    // Extract email addresses (other than from field)
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailPattern);
    if (emails && emails.length > 0) {
      contact.additionalEmails = emails;
    }
    
    return contact;
  }

  /**
   * Extract attachment references
   * @param {string} content - Email content
   * @returns {Array} Attachment references
   */
  extractAttachmentReferences(content) {
    const attachments = [];
    const attachmentPattern = /(?:attachment|document|file)[s]?\s*\d*[:\-]?\s*([^\n]+)/gi;
    
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
    // Generic parser relies more heavily on Bedrock for unstructured content
    return {
      keyTopics: [],
      budgetRange: null,
      performancePeriod: null,
      evaluationCriteria: [],
      submissionInstructions: [],
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
    // For generic parser, give more weight to Bedrock for unstructured fields
    return {
      ...ruleBasedData,
      ...bedrockData, // Bedrock takes precedence for complex fields
      extractionMethod: 'hybrid-bedrock-heavy'
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

    // Basic validation for generic parser
    if (!extractedBid.procurementType) {
      warnings.push('Procurement type not identified');
    }

    if (!extractedBid.agency) {
      warnings.push('Government agency not identified');
    }

    if (!extractedBid.solicitorationNumber) {
      warnings.push('Solicitation number not found');
    }

    if (!extractedBid.basicRequirements || extractedBid.basicRequirements.length === 0) {
      warnings.push('No basic requirements extracted');
    }

    // Generic parser has lower confidence expectations
    if (extractedBid.confidence < 0.2) {
      warnings.push('Very low confidence score for generic parser');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationScore: errors.length === 0 ? (warnings.length === 0 ? 1.0 : 0.7) : 0.4,
      recommendedAction: errors.length > 0 ? 'manual_review' : 'proceed'
    };
  }
}

module.exports = GenericParser; 