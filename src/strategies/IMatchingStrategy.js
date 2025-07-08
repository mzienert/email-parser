/**
 * IMatchingStrategy Interface
 * Strategy pattern interface for supplier matching algorithms
 */
class IMatchingStrategy {
  /**
   * Calculate a match score between extracted bid requirements and a supplier
   * @param {Object} extractedBid - The parsed bid requirements from email
   * @param {Object} supplier - The supplier record from DynamoDB
   * @returns {Promise<MatchScore>} - Score object with details
   */
  async calculateScore(extractedBid, supplier) {
    throw new Error('calculateScore method must be implemented by concrete strategy');
  }

  /**
   * Get the name of this matching strategy
   * @returns {string} - Strategy name for logging/tracking
   */
  getStrategyName() {
    throw new Error('getStrategyName method must be implemented by concrete strategy');
  }

  /**
   * Get the weight/importance of this strategy in overall scoring
   * @returns {number} - Weight from 0.0 to 1.0
   */
  getWeight() {
    throw new Error('getWeight method must be implemented by concrete strategy');
  }

  /**
   * Determine if this strategy applies to the given bid requirements
   * @param {Object} extractedBid - The parsed bid requirements
   * @returns {boolean} - True if strategy should be applied
   */
  isApplicable(extractedBid) {
    return true; // Default: strategy applies to all bids
  }
}

/**
 * MatchScore Result Object
 * Standardized result structure for all matching strategies
 */
class MatchScore {
  constructor(score, confidence, details, strategy) {
    this.score = score;           // 0.0 to 1.0 - match quality
    this.confidence = confidence; // 0.0 to 1.0 - how confident we are in the score
    this.details = details;       // Object with specific match details
    this.strategy = strategy;     // Strategy name that generated this score
    this.timestamp = new Date().toISOString();
  }

  /**
   * Create a perfect match score
   * @param {string} strategy - Strategy name
   * @param {Object} details - Match details
   * @returns {MatchScore}
   */
  static perfectMatch(strategy, details = {}) {
    return new MatchScore(1.0, 1.0, details, strategy);
  }

  /**
   * Create a no match score
   * @param {string} strategy - Strategy name
   * @param {Object} details - Match details
   * @returns {MatchScore}
   */
  static noMatch(strategy, details = {}) {
    return new MatchScore(0.0, 1.0, details, strategy);
  }

  /**
   * Create a partial match score
   * @param {number} score - Score 0.0 to 1.0
   * @param {number} confidence - Confidence 0.0 to 1.0
   * @param {string} strategy - Strategy name
   * @param {Object} details - Match details
   * @returns {MatchScore}
   */
  static partialMatch(score, confidence, strategy, details = {}) {
    return new MatchScore(score, confidence, details, strategy);
  }
}

module.exports = { IMatchingStrategy, MatchScore }; 