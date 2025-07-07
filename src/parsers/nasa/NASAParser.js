const IBidParser = require('../IBidParser');
const BedrockHelper = require('/opt/nodejs/bedrockHelper');

/**
 * NASAParser - Specialized parser for NASA procurement emails
 * 
 * Uses hybrid approach:
 * - Rule-based detection for NASA-specific patterns and requirements
 * - Bedrock LLM for complex field extraction and technical specifications
 */
class NASAParser extends IBidParser {
  constructor(bedrockClient) {
    super(bedrockClient);
  }

  /**
   * Get parser type identifier
   * @returns {string} Parser type
   */
  getParserType() {
    return 'NASA';
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

    // Strong indicators for NASA emails
    if (from.includes('nasa.gov')) score += 0.4;
    if (subject.includes('nasa')) score += 0.3;
    if (subject.includes('sewp')) score += 0.2; // NASA uses SEWP too
    if (content.includes('nasa')) score += 0.2;
    
    // NASA-specific terminology
    if (content.includes('space-qualified') || content.includes('space qualified')) score += 0.3;
    if (content.includes('fips 140-2') || content.includes('fips-140-2')) score += 0.2;
    if (content.includes('security clearance') || content.includes('clearance required')) score += 0.2;
    if (content.includes('itar') || content.includes('export control')) score += 0.2;
    if (content.includes('jpl') || content.includes('goddard') || content.includes('johnson space center')) score += 0.3;
    
    // NASA procurement patterns
    if (content.includes('national aeronautics') || content.includes('space administration')) score += 0.2;
    if (content.includes('mission critical') || content.includes('flight hardware')) score += 0.2;
    if (content.includes('radiation hardened') || content.includes('mil-std')) score += 0.2;

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Extract structured bid data from NASA email
   * @param {Object} emailData - Email data from EventBridge event
   * @returns {Promise<Object>} Structured bid data
   */
  async extractFields(emailData) {
    try {
      // Step 1: Rule-based extraction for NASA-specific elements
      const ruleBasedData = this.extractRuleBasedFields(emailData);
      
      // Step 2: Bedrock extraction for complex/unstructured elements
      const bedrockData = await this.extractBedrockFields(emailData);
      
      // Step 3: Merge and prioritize data
      const mergedData = this.mergeExtractionResults(ruleBasedData, bedrockData);
      
      return {
        emailId: emailData.emailId,
        parserType: this.getParserType(),
        confidence: this.getConfidenceScore(emailData),
        extractedAt: new Date().toISOString(),
        ...mergedData
      };
    } catch (error) {
      throw new Error(`NASAParser extraction failed: ${error.message}`);
    }
  }

  /**
   * Rule-based extraction for NASA-specific elements
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
      contractVehicle: this.detectContractVehicle(content, subject),
      
      // NASA-specific identifiers
      procurementNumber: this.extractProcurementNumber(subject, content),
      nasaCenter: this.extractNASACenter(content, emailData.from),
      
      // Security and compliance requirements
      securityRequirements: this.extractSecurityRequirements(content),
      complianceRequirements: this.extractComplianceRequirements(content),
      clearanceRequirements: this.extractClearanceRequirements(content),
      
      // Technical specifications
      technicalRequirements: this.extractTechnicalRequirements(content),
      qualificationRequirements: this.extractQualificationRequirements(content),
      
      // Delivery and performance
      deliveryRequirements: this.extractDeliveryRequirements(content),
      performanceRequirements: this.extractPerformanceRequirements(content),
      
      // Attachment references
      attachments: this.extractAttachmentReferences(content)
    };

    return extracted;
  }

  /**
   * Detect contract vehicle (SEWP, GSA, etc.)
   * @param {string} content - Email content
   * @param {string} subject - Email subject
   * @returns {string} Contract vehicle
   */
  detectContractVehicle(content, subject) {
    const combinedText = (content + ' ' + subject).toLowerCase();
    
    if (combinedText.includes('sewp v') || combinedText.includes('sewp 5')) return 'SEWP V';
    if (combinedText.includes('sewp')) return 'SEWP';
    if (combinedText.includes('gsa')) return 'GSA';
    if (combinedText.includes('cio-sp3')) return 'CIO-SP3';
    
    return 'NASA Direct';
  }

  /**
   * Extract procurement/RFQ number
   * @param {string} subject - Email subject
   * @param {string} content - Email content
   * @returns {string|null} Procurement number
   */
  extractProcurementNumber(subject, content) {
    // Try subject first
    let match = subject.match(/(?:RFQ|RFP|Quote)\s*#?\s*([A-Z0-9\-]+)/i);
    if (match) return match[1];
    
    // Try content patterns
    match = content.match(/(?:procurement|solicitation|quote)\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+)/i);
    if (match) return match[1];
    
    // NASA-specific patterns
    match = content.match(/NASA-\d{4}-\d{3}/i);
    if (match) return match[0];
    
    return null;
  }

  /**
   * Extract NASA center/facility
   * @param {string} content - Email content
   * @param {string} from - From email address
   * @returns {string|null} NASA center
   */
  extractNASACenter(content, from) {
    const contentLower = content.toLowerCase();
    const fromLower = (from || '').toLowerCase();
    
    // Map common NASA centers
    const centers = {
      'jpl': 'Jet Propulsion Laboratory (JPL)',
      'goddard': 'Goddard Space Flight Center',
      'johnson': 'Johnson Space Center',
      'kennedy': 'Kennedy Space Center',
      'langley': 'Langley Research Center',
      'glenn': 'Glenn Research Center',
      'ames': 'Ames Research Center',
      'marshall': 'Marshall Space Flight Center'
    };
    
    for (const [key, value] of Object.entries(centers)) {
      if (contentLower.includes(key) || fromLower.includes(key)) {
        return value;
      }
    }
    
    return null;
  }

  /**
   * Extract security requirements
   * @param {string} content - Email content
   * @returns {Array} Security requirements
   */
  extractSecurityRequirements(content) {
    const requirements = [];
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('fips 140-2') || contentLower.includes('fips-140-2')) {
      requirements.push('FIPS 140-2 Certification');
    }
    if (contentLower.includes('common criteria')) {
      requirements.push('Common Criteria Evaluation');
    }
    if (contentLower.includes('itar')) {
      requirements.push('ITAR Compliance');
    }
    if (contentLower.includes('export control')) {
      requirements.push('Export Control Compliance');
    }
    if (contentLower.includes('nist 800')) {
      requirements.push('NIST 800 Series Compliance');
    }
    
    return requirements;
  }

  /**
   * Extract clearance requirements
   * @param {string} content - Email content
   * @returns {Array} Clearance requirements
   */
  extractClearanceRequirements(content) {
    const requirements = [];
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('secret clearance')) {
      requirements.push('Secret Clearance');
    }
    if (contentLower.includes('top secret')) {
      requirements.push('Top Secret Clearance');
    }
    if (contentLower.includes('public trust')) {
      requirements.push('Public Trust');
    }
    if (contentLower.includes('security clearance')) {
      requirements.push('Security Clearance Required');
    }
    
    return requirements;
  }

  /**
   * Extract qualification requirements
   * @param {string} content - Email content
   * @returns {Array} Qualification requirements
   */
  extractQualificationRequirements(content) {
    const requirements = [];
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('space-qualified') || contentLower.includes('space qualified')) {
      requirements.push('Space-Qualified Components');
    }
    if (contentLower.includes('radiation hardened') || contentLower.includes('rad-hard')) {
      requirements.push('Radiation Hardened');
    }
    if (contentLower.includes('mil-std') || contentLower.includes('military standard')) {
      requirements.push('Military Standard Compliance');
    }
    if (contentLower.includes('flight hardware')) {
      requirements.push('Flight Hardware Qualified');
    }
    if (contentLower.includes('mission critical')) {
      requirements.push('Mission Critical Grade');
    }
    
    return requirements;
  }

  /**
   * Extract technical requirements
   * @param {string} content - Email content
   * @returns {Array} Technical requirements
   */
  extractTechnicalRequirements(content) {
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
    if (contentLower.includes('section 508')) {
      compliance.push('Section 508 Accessibility');
    }
    
    return compliance;
  }

  /**
   * Extract delivery requirements
   * @param {string} content - Email content
   * @returns {Object} Delivery requirements
   */
  extractDeliveryRequirements(content) {
    const requirements = {};
    
    // Extract delivery timeframe
    const timeMatch = content.match(/deliver(?:y)?\s+(?:within\s+)?(\d+)\s+(days?|weeks?|months?)/i);
    if (timeMatch) {
      requirements.timeframe = `${timeMatch[1]} ${timeMatch[2]}`;
    }
    
    // Extract delivery location
    const locationMatch = content.match(/deliver\s+to\s+([^\n]+)/i);
    if (locationMatch) {
      requirements.location = locationMatch[1].trim();
    }
    
    return requirements;
  }

  /**
   * Extract performance requirements
   * @param {string} content - Email content
   * @returns {Object} Performance requirements
   */
  extractPerformanceRequirements(content) {
    const requirements = {};
    
    // Extract uptime requirements
    const uptimeMatch = content.match(/(\d+(?:\.\d+)?)\s*%\s*uptime/i);
    if (uptimeMatch) {
      requirements.uptime = `${uptimeMatch[1]}%`;
    }
    
    // Extract response time requirements
    const responseMatch = content.match(/response\s+time[:\s]+([^\n]+)/i);
    if (responseMatch) {
      requirements.responseTime = responseMatch[1].trim();
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
    try {
      // Define the expected response format for NASA-specific extraction
      const responseFormat = {
        spaceMissionContext: {
          missionType: "Type of space mission (exploration, research, operational)",
          missionName: "Specific mission name if mentioned",
          spacecraft: "Target spacecraft or platform",
          launchDate: "Planned launch date if specified",
          missionDuration: "Mission length or operational period"
        },
        advancedTechnicalRequirements: {
          spaceQualification: ["Space qualification standards required"],
          radiationTolerance: "Radiation hardening requirements",
          temperatureRange: "Operating temperature requirements",
          vibrationTesting: "Vibration and shock testing requirements",
          outgassingLimits: "Outgassing specifications"
        },
        securityAndCompliance: {
          clearanceLevel: "Required security clearance level",
          itarRequirements: "ITAR compliance requirements",
          exportControlRequirements: ["Export control restrictions"],
          dataSecurityRequirements: ["Data handling and security requirements"]
        },
        budgetAndCost: {
          estimatedValue: "Contract estimated value",
          costBreakdown: "How costs should be structured",
          budgetConstraints: "Budget limitations mentioned",
          fundingSource: "Source of funding (NASA, DoD, etc.)"
        },
        vendorQualifications: {
          requiredCertifications: ["Required vendor certifications"],
          experienceRequired: "Experience requirements",
          facilityRequirements: ["Facility or infrastructure requirements"],
          personnelRequirements: ["Required personnel qualifications"]
        },
        deliveryAndPerformance: {
          criticalDeliveryDates: ["Key milestone dates"],
          deliveryLocation: "NASA facility for delivery",
          testingRequirements: ["Testing and validation requirements"],
          acceptanceCriteria: ["Criteria for acceptance"]
        },
        riskAssessment: {
          missionCriticalElements: ["Elements critical to mission success"],
          riskMitigationRequirements: ["Risk mitigation strategies required"],
          failureConsequences: "Consequences of component failure",
          redundancyRequirements: "Redundancy or backup requirements"
        }
      };

      // Construct the extraction prompt
      const prompt = BedrockHelper.constructExtractionPrompt(
        emailData,
        this.getParserType(),
        responseFormat
      );

      // Invoke Bedrock model
      const extractedData = await BedrockHelper.invokeModel(
        this.bedrockClient,
        prompt,
        BedrockHelper.MODELS.CLAUDE_3_7_SONNET,
        {
          temperature: 0.1,
          maxTokens: 4000
        }
      );

      // Validate extraction results
      const validation = BedrockHelper.validateBedrockExtraction(
        extractedData,
        this.getParserType()
      );

      console.log('NASA Bedrock extraction completed:', {
        emailId: emailData.emailId,
        confidence: extractedData.bedrockConfidence,
        validationPassed: validation.isValid,
        extractedFields: Object.keys(extractedData).filter(k => 
          !k.startsWith('bedrock') && extractedData[k] !== null && extractedData[k] !== undefined
        )
      });

      return {
        ...extractedData,
        bedrockValidation: validation
      };

    } catch (error) {
      console.error('NASA Bedrock extraction failed:', {
        emailId: emailData.emailId,
        error: error.message
      });

      // Return fallback structure with error information
      return {
        spaceMissionContext: {},
        advancedTechnicalRequirements: {},
        securityAndCompliance: {},
        budgetAndCost: {},
        vendorQualifications: {},
        deliveryAndPerformance: {},
        riskAssessment: {},
        bedrockError: error.message,
        bedrockConfidence: 0.0,
        bedrockProcessedAt: new Date().toISOString()
      };
    }
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

    // NASA-specific validation
    if (!extractedBid.procurementNumber) {
      warnings.push('Procurement number not found');
    }

    if (!extractedBid.nasaCenter) {
      warnings.push('NASA center/facility not identified');
    }

    if (!extractedBid.securityRequirements || extractedBid.securityRequirements.length === 0) {
      warnings.push('No security requirements identified');
    }

    if (!extractedBid.technicalRequirements || extractedBid.technicalRequirements.length === 0) {
      warnings.push('No technical requirements extracted');
    }

    // Confidence threshold validation
    if (extractedBid.confidence < 0.5) {
      warnings.push('Low confidence score for NASA parser');
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

module.exports = NASAParser; 