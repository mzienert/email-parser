const { InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

/**
 * BedrockHelper - Shared utilities for Bedrock LLM integration
 * 
 * Provides prompt construction, model invocation, and response parsing
 * for all email parser implementations.
 */
class BedrockHelper {
  /**
   * Model configurations with Claude model IDs
   */
  static MODELS = {
    CLAUDE_3_7_SONNET: 'anthropic.claude-3-7-sonnet-20250219-v1:0',
    CLAUDE_SONNET_4: 'anthropic.claude-4-sonnet-20241022-v1:0',  
    CLAUDE_OPUS_4: 'anthropic.claude-4-opus-20241022-v1:0'
  };

  /**
   * Default model configuration for email parsing
   */
  static DEFAULT_MODEL = BedrockHelper.MODELS.CLAUDE_3_7_SONNET;

  /**
   * Common prompt templates for government procurement emails
   */
  static PROMPT_TEMPLATES = {
    SYSTEM_PROMPT: `You are an expert AI assistant specialized in analyzing government procurement and contracting emails. Your task is to extract structured data from unstructured email content with high accuracy and attention to compliance requirements.

Key expertise areas:
- Government contract vehicles (SEWP, GSA, NASA contracts)
- Federal procurement regulations (FAR, DFARS)
- Business certifications (8(a), HUBZone, SDVOSB, WOSB, SDB)
- Compliance requirements (TAA, Buy American, Berry Amendment)
- Technical specifications and requirements
- Evaluation criteria and submission requirements

Always provide structured, accurate responses in the requested JSON format.`,

    EXTRACTION_PROMPT: `Analyze the following government procurement email and extract structured data. Pay careful attention to:

1. **Contract Information**: Vehicle type, RFQ/RFP numbers, agencies
2. **Requirements**: Technical specs, compliance needs, certifications required
3. **Business Information**: Vendor requirements, small business set-asides
4. **Submission Details**: Due dates, contact information, evaluation criteria
5. **Documents**: Referenced attachments, SOWs, pricing templates

Email Content:
---
Subject: {subject}
From: {from}
To: {to}
Content: {content}
---

Extract the information in the following JSON structure. If a field cannot be determined from the email, set it to null or empty array as appropriate:

{responseFormat}

Provide only the JSON response with no additional text or explanation.`
  };

  /**
   * Invoke Bedrock model with retry logic and error handling
   * @param {Object} bedrockClient - Bedrock client instance
   * @param {string} prompt - The prompt to send to the model
   * @param {string} modelId - Model ID to use (optional, defaults to Claude 3.7 Sonnet)
   * @param {Object} options - Additional options (temperature, maxTokens, etc.)
   * @returns {Promise<Object>} Parsed response from the model
   */
  static async invokeModel(bedrockClient, prompt, modelId = null, options = {}) {
    const selectedModel = modelId || BedrockHelper.DEFAULT_MODEL;
    const maxRetries = options.maxRetries || 3;
    const temperature = options.temperature || 0.1; // Low temperature for structured extraction
    const maxTokens = options.maxTokens || 4000;

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: maxTokens,
      temperature: temperature,
      system: BedrockHelper.PROMPT_TEMPLATES.SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: selectedModel,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        // Extract content from Claude response format
        const content = responseBody.content?.[0]?.text;
        if (!content) {
          throw new Error('Invalid response format from Bedrock model');
        }

        // Parse JSON response
        return BedrockHelper.parseModelResponse(content);

      } catch (error) {
        lastError = error;
        console.warn(`Bedrock invocation attempt ${attempt} failed:`, {
          modelId: selectedModel,
          error: error.message,
          retrying: attempt < maxRetries
        });

        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }

    // All retries failed
    throw new Error(`Bedrock invocation failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Parse and validate model response
   * @param {string} content - Raw content from model response
   * @returns {Object} Parsed JSON response
   */
  static parseModelResponse(content) {
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      
      // Parse JSON
      const parsed = JSON.parse(cleanContent);
      
      // Add metadata
      return {
        ...parsed,
        bedrockConfidence: BedrockHelper.calculateConfidence(parsed),
        bedrockProcessedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to parse Bedrock response:', {
        error: error.message,
        content: content?.substring(0, 500) + '...'
      });

      // Return fallback structure
      return {
        bedrockError: error.message,
        bedrockConfidence: 0.0,
        bedrockProcessedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Calculate confidence score based on extracted data completeness
   * @param {Object} extractedData - Extracted data from Bedrock
   * @returns {number} Confidence score (0-1)
   */
  static calculateConfidence(extractedData) {
    let score = 0.0;
    let maxScore = 0.0;

    // Score key fields based on presence and quality
    const scoringMap = {
      // High value fields (0.2 each)
      contractVehicle: 0.2,
      procurementNumber: 0.2,
      technicalRequirements: 0.2,
      
      // Medium value fields (0.1 each)
      complianceRequirements: 0.1,
      businessRequirements: 0.1,
      evaluationCriteria: 0.1,
      
      // Lower value fields (0.05 each)
      budgetRange: 0.05,
      dueDate: 0.05,
      contactInfo: 0.05,
      deliveryRequirements: 0.05
    };

    for (const [field, weight] of Object.entries(scoringMap)) {
      maxScore += weight;
      
      const value = extractedData[field];
      if (value) {
        if (Array.isArray(value) && value.length > 0) {
          score += weight;
        } else if (typeof value === 'string' && value.trim().length > 0) {
          score += weight;
        } else if (typeof value === 'object' && Object.keys(value).length > 0) {
          score += weight;
        }
      }
    }

    return Math.min(score / maxScore, 1.0);
  }

  /**
   * Construct email extraction prompt for specific parser type
   * @param {Object} emailData - Email data to analyze
   * @param {string} parserType - Parser type for specialized prompts
   * @param {Object} responseFormat - Expected JSON response structure
   * @returns {string} Constructed prompt
   */
  static constructExtractionPrompt(emailData, parserType, responseFormat) {
    const specializedInstructions = BedrockHelper.getSpecializedInstructions(parserType);
    
    let prompt = BedrockHelper.PROMPT_TEMPLATES.EXTRACTION_PROMPT
      .replace('{subject}', emailData.subject || 'No subject')
      .replace('{from}', emailData.from || 'Unknown sender')
      .replace('{to}', emailData.to || 'Unknown recipient')
      .replace('{content}', emailData.contentPreview || 'No content available')
      .replace('{responseFormat}', JSON.stringify(responseFormat, null, 2));

    // Add specialized instructions for specific parser types
    if (specializedInstructions) {
      prompt = `${specializedInstructions}\n\n${prompt}`;
    }

    return prompt;
  }

  /**
   * Get specialized extraction instructions for different parser types
   * @param {string} parserType - Type of parser (SEWP, NASA, GENERIC)
   * @returns {string|null} Specialized instructions
   */
  static getSpecializedInstructions(parserType) {
    const instructions = {
      'SEWP': `SPECIALIZED INSTRUCTIONS FOR SEWP PROCUREMENT:
- Focus on SEWP V contract vehicle identification
- Extract machine-readable sections with key-value pairs
- Identify brand restrictions (e.g., "Nutanix only")
- Look for business certifications: HUBZone, SDVOSB, 8(a), WOSB
- Identify compliance requirements: TAA, Buy American Act, Berry Amendment
- Extract RFQ numbers from subject lines (format: RFQ #12345)
- Parse attachment references for SOWs and pricing templates`,

      'NASA': `SPECIALIZED INSTRUCTIONS FOR NASA PROCUREMENT:
- Identify NASA centers/facilities (JPL, Goddard, Johnson, Kennedy, etc.)
- Extract space-qualified component requirements
- Look for security clearance requirements (FIPS 140-2, ITAR)
- Identify mission-critical performance standards
- Extract NASA-specific procurement numbers (NASA-YYYY-XXX format)
- Focus on technical specifications for space/aviation applications
- Identify contract vehicles (SEWP, GSA, CIO-SP3, NASA Direct)`,

      'GENERIC': `SPECIALIZED INSTRUCTIONS FOR GENERAL GOVERNMENT PROCUREMENT:
- Identify government agency from email domain or content
- Determine procurement type (RFP, RFQ, RFI, IFB, BAA)
- Extract solicitation numbers in various formats
- Look for general small business set-aside requirements
- Identify federal contracting requirements and clauses
- Extract contact information for contracting officers
- Focus on evaluation criteria and submission requirements`
    };

    return instructions[parserType] || null;
  }

  /**
   * Validate extracted data against business rules
   * @param {Object} extractedData - Data extracted by Bedrock
   * @param {string} parserType - Parser type for validation rules
   * @returns {Object} Validation results
   */
  static validateBedrockExtraction(extractedData, parserType) {
    const errors = [];
    const warnings = [];

    // General validation rules
    if (extractedData.bedrockError) {
      errors.push(`Bedrock processing error: ${extractedData.bedrockError}`);
    }

    if (extractedData.bedrockConfidence < 0.3) {
      warnings.push('Low confidence in Bedrock extraction results');
    }

    // Parser-specific validation rules
    switch (parserType) {
      case 'SEWP':
        if (!extractedData.contractVehicle || !extractedData.contractVehicle.includes('SEWP')) {
          warnings.push('SEWP contract vehicle not identified in SEWP-parsed email');
        }
        break;

      case 'NASA':
        if (!extractedData.nasaCenter && !extractedData.contractVehicle) {
          warnings.push('Neither NASA center nor contract vehicle identified');
        }
        break;

      case 'GENERIC':
        if (!extractedData.agency && !extractedData.procurementType) {
          warnings.push('Neither agency nor procurement type identified');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      bedrockValidationScore: errors.length === 0 ? 
        (warnings.length === 0 ? 1.0 : 0.7) : 0.3
    };
  }
}

module.exports = BedrockHelper; 