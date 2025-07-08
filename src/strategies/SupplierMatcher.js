const { IMatchingStrategy, MatchScore } = require('./IMatchingStrategy');
const FuzzyMatchingStrategy = require('./FuzzyMatchingStrategy');
const ComplianceFilterStrategy = require('./ComplianceFilterStrategy');
const GeographicStrategy = require('./GeographicStrategy');

/**
 * SupplierMatcher - Strategy Pattern Context
 * Orchestrates multiple matching strategies to find the best supplier matches
 */
class SupplierMatcher {
  constructor() {
    this.strategies = [];
    this.defaultStrategies = [
      new ComplianceFilterStrategy(),
      new FuzzyMatchingStrategy(),
      new GeographicStrategy()
    ];
    
    // Initialize with default strategies
    this.strategies = [...this.defaultStrategies];
  }

  /**
   * Add a custom strategy to the matcher
   * @param {IMatchingStrategy} strategy - Strategy to add
   */
  addStrategy(strategy) {
    if (!(strategy instanceof IMatchingStrategy)) {
      throw new Error('Strategy must implement IMatchingStrategy interface');
    }
    this.strategies.push(strategy);
  }

  /**
   * Remove a strategy by name
   * @param {string} strategyName - Name of strategy to remove
   */
  removeStrategy(strategyName) {
    this.strategies = this.strategies.filter(s => s.getStrategyName() !== strategyName);
  }

  /**
   * Get all active strategies
   * @returns {IMatchingStrategy[]} - Array of active strategies
   */
  getStrategies() {
    return [...this.strategies];
  }

  /**
   * Match a single supplier against bid requirements
   * @param {Object} extractedBid - Parsed bid requirements
   * @param {Object} supplier - Supplier record
   * @returns {Promise<SupplierMatchResult>} - Detailed match result
   */
  async matchSupplier(extractedBid, supplier) {
    const matchResult = new SupplierMatchResult(supplier);
    
    // Apply each strategy
    for (const strategy of this.strategies) {
      if (strategy.isApplicable(extractedBid)) {
        try {
          const matchScore = await strategy.calculateScore(extractedBid, supplier);
          matchResult.addStrategyScore(matchScore);
        } catch (error) {
          console.error(`Error in strategy ${strategy.getStrategyName()}:`, error);
          // Add error result but continue with other strategies
          matchResult.addError(strategy.getStrategyName(), error.message);
        }
      }
    }
    
    // Calculate composite score
    matchResult.calculateCompositeScore();
    
    return matchResult;
  }

  /**
   * Match multiple suppliers against bid requirements
   * @param {Object} extractedBid - Parsed bid requirements
   * @param {Object[]} suppliers - Array of supplier records
   * @returns {Promise<SupplierMatchResult[]>} - Array of match results, sorted by score
   */
  async matchSuppliers(extractedBid, suppliers) {
    const matchPromises = suppliers.map(supplier => 
      this.matchSupplier(extractedBid, supplier)
    );
    
    const results = await Promise.all(matchPromises);
    
    // Sort by composite score (highest first)
    results.sort((a, b) => b.compositeScore - a.compositeScore);
    
    return results;
  }

  /**
   * Get top N supplier matches
   * @param {Object} extractedBid - Parsed bid requirements
   * @param {Object[]} suppliers - Array of supplier records
   * @param {number} topN - Number of top matches to return
   * @returns {Promise<SupplierMatchResult[]>} - Top N matches
   */
  async getTopMatches(extractedBid, suppliers, topN = 5) {
    const results = await this.matchSuppliers(extractedBid, suppliers);
    return results.slice(0, topN);
  }

  /**
   * Filter suppliers by minimum score threshold
   * @param {Object} extractedBid - Parsed bid requirements
   * @param {Object[]} suppliers - Array of supplier records
   * @param {number} minScore - Minimum composite score (0.0 to 1.0)
   * @returns {Promise<SupplierMatchResult[]>} - Filtered results
   */
  async filterByScore(extractedBid, suppliers, minScore = 0.5) {
    const results = await this.matchSuppliers(extractedBid, suppliers);
    return results.filter(result => result.compositeScore >= minScore);
  }

  /**
   * Get match summary statistics
   * @param {SupplierMatchResult[]} results - Array of match results
   * @returns {Object} - Summary statistics
   */
  getMatchSummary(results) {
    if (results.length === 0) {
      return {
        totalSuppliers: 0,
        averageScore: 0,
        topScore: 0,
        strategySummary: {}
      };
    }

    const scores = results.map(r => r.compositeScore);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const topScore = Math.max(...scores);
    
    // Strategy-specific statistics
    const strategySummary = {};
    for (const strategy of this.strategies) {
      const strategyName = strategy.getStrategyName();
      const strategyScores = results
        .map(r => r.strategyScores[strategyName])
        .filter(score => score !== undefined)
        .map(score => score.score);
      
      if (strategyScores.length > 0) {
        strategySummary[strategyName] = {
          averageScore: strategyScores.reduce((sum, score) => sum + score, 0) / strategyScores.length,
          topScore: Math.max(...strategyScores),
          weight: strategy.getWeight(),
          applicableCount: strategyScores.length
        };
      }
    }
    
    return {
      totalSuppliers: results.length,
      averageScore: averageScore,
      topScore: topScore,
      strategySummary: strategySummary
    };
  }
}

/**
 * SupplierMatchResult - Aggregates results from all strategies
 */
class SupplierMatchResult {
  constructor(supplier) {
    this.supplier = supplier;
    this.supplierId = supplier.supplierId;
    this.companyName = supplier.companyName;
    this.strategyScores = {};
    this.compositeScore = 0;
    this.confidence = 0;
    this.errors = [];
    this.matchDetails = {
      strengths: [],
      weaknesses: [],
      recommendations: []
    };
  }

  /**
   * Add a strategy score to the result
   * @param {MatchScore} matchScore - Score from a strategy
   */
  addStrategyScore(matchScore) {
    this.strategyScores[matchScore.strategy] = matchScore;
  }

  /**
   * Add an error for a strategy
   * @param {string} strategyName - Name of strategy that failed
   * @param {string} errorMessage - Error message
   */
  addError(strategyName, errorMessage) {
    this.errors.push({
      strategy: strategyName,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Calculate composite score from all strategies
   */
  calculateCompositeScore() {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let totalConfidence = 0;
    let strategyCount = 0;

    // Get available strategies (those that returned scores)
    const availableStrategies = Object.values(this.strategyScores);
    
    if (availableStrategies.length === 0) {
      this.compositeScore = 0;
      this.confidence = 0;
      return;
    }

    // Calculate weighted composite score
    for (const [strategyName, matchScore] of Object.entries(this.strategyScores)) {
      const weight = this.getStrategyWeight(strategyName);
      totalWeightedScore += matchScore.score * weight;
      totalWeight += weight;
      totalConfidence += matchScore.confidence;
      strategyCount++;
    }

    this.compositeScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    this.confidence = strategyCount > 0 ? totalConfidence / strategyCount : 0;

    // Analyze match details
    this.analyzeMatchDetails();
  }

  /**
   * Get strategy weight by name
   * @param {string} strategyName - Name of the strategy
   * @returns {number} - Weight of the strategy
   */
  getStrategyWeight(strategyName) {
    const weights = {
      'ComplianceFilterStrategy': 0.4,
      'FuzzyMatchingStrategy': 0.3,
      'GeographicStrategy': 0.3
    };
    return weights[strategyName] || 0.2;
  }

  /**
   * Analyze match details to identify strengths and weaknesses
   */
  analyzeMatchDetails() {
    const strengths = [];
    const weaknesses = [];
    const recommendations = [];

    for (const [strategyName, matchScore] of Object.entries(this.strategyScores)) {
      if (matchScore.score >= 0.8) {
        strengths.push(`${strategyName}: ${(matchScore.score * 100).toFixed(1)}%`);
      } else if (matchScore.score <= 0.3) {
        weaknesses.push(`${strategyName}: ${(matchScore.score * 100).toFixed(1)}%`);
      }

      // Strategy-specific recommendations
      if (strategyName === 'ComplianceFilterStrategy' && matchScore.score < 0.5) {
        recommendations.push('Review compliance certifications and government experience');
      }
      
      if (strategyName === 'GeographicStrategy' && matchScore.score < 0.5) {
        recommendations.push('Consider delivery logistics and regional support capabilities');
      }
      
      if (strategyName === 'FuzzyMatchingStrategy' && matchScore.score < 0.5) {
        recommendations.push('Verify technical capabilities and brand authorizations');
      }
    }

    this.matchDetails = {
      strengths,
      weaknesses,
      recommendations
    };
  }

  /**
   * Get detailed breakdown of the match
   * @returns {Object} - Detailed match breakdown
   */
  getDetailedBreakdown() {
    return {
      supplier: {
        id: this.supplierId,
        name: this.companyName,
        businessCertifications: this.supplier.businessCertifications,
        complianceStatus: this.supplier.complianceStatus,
        state: this.supplier.geographicCapabilities?.state
      },
      scoring: {
        compositeScore: this.compositeScore,
        confidence: this.confidence,
        strategyScores: this.strategyScores
      },
      analysis: this.matchDetails,
      errors: this.errors
    };
  }

  /**
   * Get summary for quick review
   * @returns {Object} - Match summary
   */
  getSummary() {
    return {
      supplierId: this.supplierId,
      companyName: this.companyName,
      compositeScore: this.compositeScore,
      confidence: this.confidence,
      complianceStatus: this.supplier.complianceStatus,
      state: this.supplier.geographicCapabilities?.state,
      strengths: this.matchDetails.strengths.slice(0, 3),
      hasErrors: this.errors.length > 0
    };
  }
}

module.exports = { SupplierMatcher, SupplierMatchResult }; 