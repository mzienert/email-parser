const SEWPParser = require('../parsers/sewp/SEWPParser');
const NASAParser = require('../parsers/nasa/NASAParser');
const GenericParser = require('../parsers/generic/GenericParser');

/**
 * BidParserFactory - Factory pattern implementation for email parser selection
 * 
 * Selects the most appropriate parser based on confidence scores from each parser type.
 * Follows the Factory pattern to abstract parser instantiation and selection logic.
 */
class BidParserFactory {
  /**
   * Create the most appropriate parser for the given email data
   * @param {Object} emailData - Email data from EventBridge event
   * @param {Object} bedrockClient - Bedrock client for LLM integration
   * @returns {IBidParser} Selected parser instance
   */
  static createParser(emailData, bedrockClient) {
    // Get all available parser types
    const parserTypes = BidParserFactory.getAvailableParserTypes();
    
    // Score each parser type
    const parserScores = parserTypes.map(ParserClass => {
      const tempParser = new ParserClass(bedrockClient);
      return {
        ParserClass,
        score: tempParser.getConfidenceScore(emailData),
        type: tempParser.getParserType()
      };
    });

    // Sort by confidence score (highest first)
    parserScores.sort((a, b) => b.score - a.score);

    // Log parser selection process
    console.log('Parser selection analysis:', {
      emailId: emailData.emailId,
      subject: emailData.subject,
      scores: parserScores.map(p => ({
        type: p.type,
        score: p.score
      })),
      selected: parserScores[0].type
    });

    // Select parser with highest confidence
    const selectedParser = parserScores[0];
    
    // Apply minimum confidence threshold
    if (selectedParser.score < 0.1) {
      console.warn('All parsers have very low confidence, defaulting to GenericParser');
      return new GenericParser(bedrockClient);
    }

    return new selectedParser.ParserClass(bedrockClient);
  }

  /**
   * Get all available parser types
   * @returns {Array} Array of parser classes
   */
  static getAvailableParserTypes() {
    return [
      SEWPParser,
      NASAParser,
      GenericParser
    ];
  }

  /**
   * Get parser type by name
   * @param {string} parserType - Parser type name (e.g., 'SEWP', 'NASA', 'GENERIC')
   * @param {Object} bedrockClient - Bedrock client
   * @returns {IBidParser} Parser instance
   */
  static createParserByType(parserType, bedrockClient) {
    const parserMap = {
      'SEWP': SEWPParser,
      'NASA': NASAParser,
      'GENERIC': GenericParser
    };

    const ParserClass = parserMap[parserType.toUpperCase()];
    if (!ParserClass) {
      throw new Error(`Unknown parser type: ${parserType}. Available types: ${Object.keys(parserMap).join(', ')}`);
    }

    return new ParserClass(bedrockClient);
  }

  /**
   * Get available parser types list
   * @returns {Array} Array of parser type names
   */
  static getAvailableParserTypeNames() {
    return BidParserFactory.getAvailableParserTypes().map(ParserClass => {
      const tempParser = new ParserClass(null);
      return tempParser.getParserType();
    });
  }

  /**
   * Analyze email with all parsers (for debugging/comparison)
   * @param {Object} emailData - Email data
   * @param {Object} bedrockClient - Bedrock client
   * @returns {Object} Analysis results from all parsers
   */
  static async analyzeWithAllParsers(emailData, bedrockClient) {
    const parserTypes = BidParserFactory.getAvailableParserTypes();
    const results = {};

    for (const ParserClass of parserTypes) {
      const parser = new ParserClass(bedrockClient);
      const parserType = parser.getParserType();
      
      try {
        results[parserType] = {
          confidence: parser.getConfidenceScore(emailData),
          type: parserType,
          // Don't run full extraction for analysis - just confidence scoring
          status: 'available'
        };
      } catch (error) {
        results[parserType] = {
          confidence: 0,
          type: parserType,
          status: 'error',
          error: error.message
        };
      }
    }

    return results;
  }
}

module.exports = BidParserFactory; 