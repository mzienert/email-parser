const { IMatchingStrategy, MatchScore } = require('./IMatchingStrategy');

/**
 * ComplianceFilterStrategy
 * Filters suppliers based on government compliance requirements
 * Critical for government contracting - TAA, EPEAT, business certifications
 */
class ComplianceFilterStrategy extends IMatchingStrategy {
  constructor() {
    super();
    this.strategyName = 'ComplianceFilterStrategy';
    this.weight = 0.4; // 40% weight - highest priority for government contracts
  }

  /**
   * Calculate compliance score based on government requirements
   * @param {Object} extractedBid - The parsed bid requirements from email
   * @param {Object} supplier - The supplier record from DynamoDB
   * @returns {Promise<MatchScore>} - Score object with details
   */
  async calculateScore(extractedBid, supplier) {
    const details = {
      taaCompliance: 0,
      epeatCompliance: 0,
      businessCertifications: 0,
      securityClearance: 0,
      federalExperience: 0,
      authorizedReseller: 0,
      overallCompliance: 'UNKNOWN',
      breakdown: {},
      requirementsMet: [],
      requirementsMissed: []
    };

    let totalScore = 0;
    let maxScore = 0;
    let criticalFailures = 0;

    // 1. TAA Compliance (Critical - binary pass/fail)
    const taaScore = this.evaluateTAACompliance(extractedBid, supplier);
    details.taaCompliance = taaScore;
    details.breakdown.taaCompliance = `TAA Compliance: ${taaScore > 0 ? 'PASS' : 'FAIL'}`;
    
    if (this.requiresTAACompliance(extractedBid)) {
      if (taaScore === 0) {
        criticalFailures++;
        details.requirementsMissed.push('TAA Compliance Required');
      } else {
        details.requirementsMet.push('TAA Compliance Verified');
      }
      totalScore += taaScore * 0.3;
      maxScore += 0.3;
    }

    // 2. EPEAT Compliance
    const epeatScore = this.evaluateEPEATCompliance(extractedBid, supplier);
    details.epeatCompliance = epeatScore;
    details.breakdown.epeatCompliance = `EPEAT Compliance: ${(epeatScore * 100).toFixed(1)}%`;
    
    if (this.requiresEPEATCompliance(extractedBid)) {
      if (epeatScore > 0) {
        details.requirementsMet.push(`EPEAT Compliance: ${this.getEPEATLevel(supplier)}`);
      } else {
        details.requirementsMissed.push('EPEAT Compliance Required');
      }
      totalScore += epeatScore * 0.15;
      maxScore += 0.15;
    }

    // 3. Business Certifications (HUBZone, SDVOSB, 8(a), WOSB)
    const businessCertScore = this.evaluateBusinessCertifications(extractedBid, supplier);
    details.businessCertifications = businessCertScore;
    details.breakdown.businessCertifications = `Business Certifications: ${(businessCertScore * 100).toFixed(1)}%`;
    
    if (businessCertScore > 0) {
      details.requirementsMet.push(`Business Certifications: ${supplier.businessCertifications?.join(', ') || 'None'}`);
    }
    totalScore += businessCertScore * 0.2;
    maxScore += 0.2;

    // 4. Security Clearance
    const securityScore = this.evaluateSecurityClearance(extractedBid, supplier);
    details.securityClearance = securityScore;
    details.breakdown.securityClearance = `Security Clearance: ${(securityScore * 100).toFixed(1)}%`;
    
    if (securityScore > 0) {
      details.requirementsMet.push(`Security Clearance: ${supplier.complianceDetails?.securityClearance?.join(', ') || 'None'}`);
    }
    totalScore += securityScore * 0.1;
    maxScore += 0.1;

    // 5. Federal Contract Experience
    const federalScore = this.evaluateFederalExperience(extractedBid, supplier);
    details.federalExperience = federalScore;
    details.breakdown.federalExperience = `Federal Experience: ${(federalScore * 100).toFixed(1)}%`;
    
    if (federalScore > 0) {
      details.requirementsMet.push('Federal Contract Experience Verified');
    }
    totalScore += federalScore * 0.15;
    maxScore += 0.15;

    // 6. Authorized Reseller Status
    const resellerScore = this.evaluateAuthorizedReseller(extractedBid, supplier);
    details.authorizedReseller = resellerScore;
    details.breakdown.authorizedReseller = `Authorized Reseller: ${(resellerScore * 100).toFixed(1)}%`;
    
    if (resellerScore > 0) {
      details.requirementsMet.push('Authorized Reseller Status Verified');
    } else if (this.requiresAuthorizedReseller(extractedBid)) {
      details.requirementsMissed.push('Authorized Reseller Status Required');
      criticalFailures++;
    }
    totalScore += resellerScore * 0.1;
    maxScore += 0.1;

    // Calculate final score
    const finalScore = maxScore > 0 ? totalScore / maxScore : 0;
    
    // Determine overall compliance status
    if (criticalFailures > 0) {
      details.overallCompliance = 'NON_COMPLIANT';
    } else if (finalScore >= 0.8) {
      details.overallCompliance = 'FULLY_COMPLIANT';
    } else if (finalScore >= 0.6) {
      details.overallCompliance = 'PARTIALLY_COMPLIANT';
    } else {
      details.overallCompliance = 'INSUFFICIENT_COMPLIANCE';
    }

    // Confidence based on data availability
    const confidence = this.calculateConfidence(supplier);

    return MatchScore.partialMatch(finalScore, confidence, this.strategyName, details);
  }

  /**
   * Evaluate TAA compliance
   * @param {Object} extractedBid - Parsed bid requirements
   * @param {Object} supplier - Supplier record
   * @returns {number} - Score 0.0 or 1.0 (binary)
   */
  evaluateTAACompliance(extractedBid, supplier) {
    if (!supplier.complianceDetails) return 0;
    return supplier.complianceDetails.taaCompliant ? 1.0 : 0.0;
  }

  /**
   * Evaluate EPEAT compliance
   * @param {Object} extractedBid - Parsed bid requirements
   * @param {Object} supplier - Supplier record
   * @returns {number} - Score 0.0 to 1.0
   */
  evaluateEPEATCompliance(extractedBid, supplier) {
    if (!supplier.complianceDetails || !supplier.complianceDetails.epeatLevels) return 0;
    
    const epeatLevels = supplier.complianceDetails.epeatLevels;
    
    // Score based on EPEAT level
    if (epeatLevels.includes('Gold')) return 1.0;
    if (epeatLevels.includes('Silver')) return 0.8;
    if (epeatLevels.includes('Bronze')) return 0.6;
    
    return 0;
  }

  /**
   * Evaluate business certifications
   * @param {Object} extractedBid - Parsed bid requirements
   * @param {Object} supplier - Supplier record
   * @returns {number} - Score 0.0 to 1.0
   */
  evaluateBusinessCertifications(extractedBid, supplier) {
    if (!supplier.businessCertifications || supplier.businessCertifications.length === 0) {
      return 0;
    }

    const certifications = supplier.businessCertifications;
    const bidText = this.extractBidText(extractedBid).toLowerCase();
    
    // Higher value certifications for government contracts
    const certificationValues = {
      'HUBZone': 1.0,
      'SDVOSB': 1.0,
      '8(a)': 1.0,
      'WOSB': 0.8,
      'SDB': 0.6,
      'VET': 0.4
    };
    
    let maxValue = 0;
    for (const cert of certifications) {
      const value = certificationValues[cert] || 0;
      if (value > maxValue) {
        maxValue = value;
      }
    }
    
    // Bonus if bid specifically mentions set-aside requirements
    if (bidText.includes('hubzone') || bidText.includes('sdvosb') || bidText.includes('8(a)') || bidText.includes('wosb')) {
      maxValue = Math.min(1.0, maxValue * 1.2);
    }
    
    return maxValue;
  }

  /**
   * Evaluate security clearance capabilities
   * @param {Object} extractedBid - Parsed bid requirements
   * @param {Object} supplier - Supplier record
   * @returns {number} - Score 0.0 to 1.0
   */
  evaluateSecurityClearance(extractedBid, supplier) {
    if (!supplier.complianceDetails || !supplier.complianceDetails.securityClearance) return 0;
    
    const clearances = supplier.complianceDetails.securityClearance;
    const bidText = this.extractBidText(extractedBid).toLowerCase();
    
    // Score based on clearance level
    let score = 0;
    if (clearances.includes('CSOFT')) score = Math.max(score, 1.0);
    if (clearances.includes('CNET')) score = Math.max(score, 0.8);
    if (clearances.includes('CSAT')) score = Math.max(score, 0.6);
    if (clearances.includes('C')) score = Math.max(score, 0.4);
    
    // Bonus if bid mentions security requirements
    if (bidText.includes('security') || bidText.includes('clearance') || bidText.includes('classified')) {
      score = Math.min(1.0, score * 1.2);
    }
    
    return score;
  }

  /**
   * Evaluate federal contract experience
   * @param {Object} extractedBid - Parsed bid requirements
   * @param {Object} supplier - Supplier record
   * @returns {number} - Score 0.0 to 1.0
   */
  evaluateFederalExperience(extractedBid, supplier) {
    if (!supplier.pastPerformance) return 0;
    
    const pastPerformance = supplier.pastPerformance;
    let score = 0;
    
    // Federal contract history
    if (pastPerformance.federalContractHistory) {
      score += 0.3;
    }
    
    // SEWP experience
    if (pastPerformance.sewpExperience) {
      score += 0.4;
    }
    
    // NASA experience
    if (pastPerformance.nasaExperience) {
      score += 0.2;
    }
    
    // GSA Schedule
    if (pastPerformance.gsaSchedule) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Evaluate authorized reseller status
   * @param {Object} extractedBid - Parsed bid requirements
   * @param {Object} supplier - Supplier record
   * @returns {number} - Score 0.0 to 1.0
   */
  evaluateAuthorizedReseller(extractedBid, supplier) {
    if (!supplier.authorizedReseller) return 0;
    
    const bidText = this.extractBidText(extractedBid).toLowerCase();
    const brands = ['nutanix', 'cisco', 'dell', 'hp', 'microsoft', 'vmware'];
    
    let score = 0;
    let requiredBrands = 0;
    
    for (const brand of brands) {
      if (bidText.includes(brand)) {
        requiredBrands++;
        if (supplier.authorizedReseller[brand]) {
          score += 1;
        }
      }
    }
    
    return requiredBrands > 0 ? score / requiredBrands : 0.5;
  }

  /**
   * Helper methods to determine requirements from bid
   */
  requiresTAACompliance(extractedBid) {
    const bidText = this.extractBidText(extractedBid).toLowerCase();
    return bidText.includes('taa') || bidText.includes('trade agreements act') || bidText.includes('compliance');
  }

  requiresEPEATCompliance(extractedBid) {
    const bidText = this.extractBidText(extractedBid).toLowerCase();
    return bidText.includes('epeat') || bidText.includes('environmental');
  }

  requiresAuthorizedReseller(extractedBid) {
    const bidText = this.extractBidText(extractedBid).toLowerCase();
    return bidText.includes('authorized') || bidText.includes('reseller') || bidText.includes('nutanix') || bidText.includes('cisco');
  }

  /**
   * Get EPEAT level description
   * @param {Object} supplier - Supplier record
   * @returns {string} - EPEAT level
   */
  getEPEATLevel(supplier) {
    if (!supplier.complianceDetails || !supplier.complianceDetails.epeatLevels) return 'None';
    
    const levels = supplier.complianceDetails.epeatLevels;
    if (levels.includes('Gold')) return 'Gold';
    if (levels.includes('Silver')) return 'Silver';
    if (levels.includes('Bronze')) return 'Bronze';
    return 'None';
  }

  /**
   * Calculate confidence based on data availability
   * @param {Object} supplier - Supplier record
   * @returns {number} - Confidence 0.0 to 1.0
   */
  calculateConfidence(supplier) {
    let dataPoints = 0;
    let availablePoints = 0;
    
    if (supplier.complianceDetails) {
      availablePoints++;
      if (supplier.complianceDetails.taaCompliant !== undefined) dataPoints++;
    }
    
    if (supplier.businessCertifications) {
      availablePoints++;
      if (supplier.businessCertifications.length > 0) dataPoints++;
    }
    
    if (supplier.pastPerformance) {
      availablePoints++;
      if (supplier.pastPerformance.federalContractHistory !== undefined) dataPoints++;
    }
    
    if (supplier.authorizedReseller) {
      availablePoints++;
      dataPoints++;
    }
    
    return availablePoints > 0 ? dataPoints / availablePoints : 0.5;
  }

  /**
   * Extract searchable text from bid requirements
   * @param {Object} extractedBid - Parsed bid requirements
   * @returns {string} - Combined searchable text
   */
  extractBidText(extractedBid) {
    let text = '';
    
    if (extractedBid.subject) text += extractedBid.subject + ' ';
    if (extractedBid.body) text += extractedBid.body + ' ';
    if (extractedBid.requirements) text += JSON.stringify(extractedBid.requirements) + ' ';
    if (extractedBid.items) {
      for (const item of extractedBid.items) {
        if (item.name) text += item.name + ' ';
        if (item.description) text += item.description + ' ';
      }
    }
    
    return text;
  }

  getStrategyName() {
    return this.strategyName;
  }

  getWeight() {
    return this.weight;
  }

  isApplicable(extractedBid) {
    // Always applicable for government contracts
    return true;
  }
}

module.exports = ComplianceFilterStrategy; 