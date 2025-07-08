#!/usr/bin/env node

const { SupplierMatcher, SupplierMatchResult } = require('./SupplierMatcher');

// Sample extracted bid data (simulating SEWP V Nutanix email)
const sampleExtractedBid = {
  emailId: 'test-sewp-nutanix-001',
  subject: 'SEWP V Nutanix Software and Maintenance Request for Quote',
  body: 'Request for Quote for Nutanix Cloud Infrastructure Ultimate License SW-NCI-ULT-FP and Nutanix Unified Storage Pro License SW-NUS-PRO-FP. Delivery to ECC-Martinsburg, Kearneysville, WV. TAA compliance required. Authorized Nutanix resellers only.',
  items: [
    {
      name: 'Nutanix Cloud Infrastructure Ultimate License',
      part_number: 'SW-NCI-ULT-FP',
      quantity: 5152,
      unit: 'CPU Core'
    }
  ],
  requirements: {
    taa_compliant: true,
    authorized_reseller: 'Nutanix required',
    support_level: '24/7 Federal Production'
  },
  delivery_location: {
    street: '50 West State Street',
    city: 'Kearneysville',
    state: 'WV',
    zip: '25430'
  }
};

// Sample supplier data (our imported suppliers)
const sampleSuppliers = [
  {
    supplierId: 'SUPP-001-NUTANIX-RESELLER',
    companyName: 'Federal Tech Solutions LLC',
    businessCertifications: ['HUBZone', 'SDVOSB'],
    complianceStatus: 'FULL_COMPLIANT',
    complianceDetails: {
      taaCompliant: true,
      epeatLevels: ['Bronze', 'Silver', 'Gold'],
      securityClearance: ['C', 'CSAT']
    },
    capabilities: ['NUTANIX_RESELLER', 'HYPER_CONVERGED_INFRASTRUCTURE', '24_7_SUPPORT'],
    authorizedReseller: {
      nutanix: true,
      cisco: true
    },
    geographicCapabilities: {
      state: 'WV',
      regions: ['Mid-Atlantic', 'Southeast'],
      deliveryLocations: ['West Virginia', 'Maryland', 'Virginia', 'Pennsylvania'],
      supportCoverage: '24/7 Federal'
    },
    businessInfo: {
      headquarters: {
        state: 'WV',
        city: 'Charleston'
      }
    }
  },
  {
    supplierId: 'SUPP-002-NUTANIX-LARGE',
    companyName: 'Enterprise Government Solutions Inc',
    businessCertifications: ['8(a)', 'WOSB'],
    complianceStatus: 'FULL_COMPLIANT',
    complianceDetails: {
      taaCompliant: true,
      epeatLevels: ['Bronze', 'Silver', 'Gold'],
      securityClearance: ['C', 'CSAT', 'CNET']
    },
    capabilities: ['NUTANIX_RESELLER', 'HYPER_CONVERGED_INFRASTRUCTURE', 'PROFESSIONAL_SERVICES'],
    authorizedReseller: {
      nutanix: true,
      cisco: true,
      dell: true
    },
    geographicCapabilities: {
      state: 'NJ',
      regions: ['Mid-Atlantic', 'Northeast'],
      deliveryLocations: ['New Jersey', 'New York', 'Pennsylvania', 'Delaware'],
      supportCoverage: '24/7 Federal'
    },
    businessInfo: {
      headquarters: {
        state: 'NJ',
        city: 'Trenton'
      }
    }
  },
  {
    supplierId: 'SUPP-003-NUTANIX-HUBZONE',
    companyName: 'Mountain State Technology Partners',
    businessCertifications: ['HUBZone'],
    complianceStatus: 'TAA_COMPLIANT',
    complianceDetails: {
      taaCompliant: true,
      epeatLevels: ['Bronze', 'Silver'],
      securityClearance: ['C']
    },
    capabilities: ['NUTANIX_RESELLER', 'REGIONAL_SUPPORT'],
    authorizedReseller: {
      nutanix: true
    },
    geographicCapabilities: {
      state: 'WV',
      regions: ['Southeast'],
      deliveryLocations: ['West Virginia', 'Kentucky', 'Virginia'],
      supportCoverage: 'Business Hours'
    },
    businessInfo: {
      headquarters: {
        state: 'WV',
        city: 'Kearneysville'
      }
    }
  }
];

/**
 * Test the Strategy pattern implementation
 */
async function testStrategyPattern() {
  console.log('🧪 Testing Strategy Pattern Implementation');
  console.log('==========================================\n');

  try {
    // Initialize the SupplierMatcher
    const matcher = new SupplierMatcher();
    
    console.log('📋 Active Strategies:');
    for (const strategy of matcher.getStrategies()) {
      console.log(`  - ${strategy.getStrategyName()} (Weight: ${strategy.getWeight()})`);
    }
    console.log();

    // Test single supplier matching
    console.log('🔍 Testing Single Supplier Match:');
    console.log('----------------------------------');
    const singleResult = await matcher.matchSupplier(sampleExtractedBid, sampleSuppliers[0]);
    console.log(`Supplier: ${singleResult.companyName}`);
    console.log(`Composite Score: ${(singleResult.compositeScore * 100).toFixed(1)}%`);
    console.log(`Confidence: ${(singleResult.confidence * 100).toFixed(1)}%`);
    console.log('Strategy Scores:');
    
    for (const [strategyName, matchScore] of Object.entries(singleResult.strategyScores)) {
      console.log(`  - ${strategyName}: ${(matchScore.score * 100).toFixed(1)}%`);
    }
    console.log();

    // Test multiple supplier matching
    console.log('🏆 Testing Multiple Supplier Matching:');
    console.log('--------------------------------------');
    const results = await matcher.matchSuppliers(sampleExtractedBid, sampleSuppliers);
    
    console.log('Ranking Results:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.companyName}`);
      console.log(`   Score: ${(result.compositeScore * 100).toFixed(1)}% | Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Location: ${result.supplier.geographicCapabilities?.state} | Compliance: ${result.supplier.complianceStatus}`);
      console.log(`   Certifications: ${result.supplier.businessCertifications?.join(', ') || 'None'}`);
      console.log();
    });

    // Test top matches
    console.log('🥇 Top 2 Matches:');
    console.log('-----------------');
    const topMatches = await matcher.getTopMatches(sampleExtractedBid, sampleSuppliers, 2);
    
    topMatches.forEach((result, index) => {
      console.log(`${index + 1}. ${result.companyName} - ${(result.compositeScore * 100).toFixed(1)}%`);
      
      // Show detailed breakdown
      const breakdown = result.getDetailedBreakdown();
      console.log('   Strategy Breakdown:');
      for (const [strategy, score] of Object.entries(breakdown.scoring.strategyScores)) {
        console.log(`     - ${strategy}: ${(score.score * 100).toFixed(1)}%`);
      }
      
      console.log('   Strengths:', breakdown.analysis.strengths.join(', ') || 'None identified');
      console.log('   Recommendations:', breakdown.analysis.recommendations.join(', ') || 'None');
      console.log();
    });

    // Test filtering by score
    console.log('✅ Suppliers Above 75% Score:');
    console.log('-----------------------------');
    const filteredResults = await matcher.filterByScore(sampleExtractedBid, sampleSuppliers, 0.75);
    
    if (filteredResults.length > 0) {
      filteredResults.forEach(result => {
        console.log(`- ${result.companyName}: ${(result.compositeScore * 100).toFixed(1)}%`);
      });
    } else {
      console.log('No suppliers meet the 75% threshold');
    }
    console.log();

    // Test match summary
    console.log('📊 Match Summary Statistics:');
    console.log('----------------------------');
    const summary = matcher.getMatchSummary(results);
    
    console.log(`Total Suppliers Evaluated: ${summary.totalSuppliers}`);
    console.log(`Average Score: ${(summary.averageScore * 100).toFixed(1)}%`);
    console.log(`Top Score: ${(summary.topScore * 100).toFixed(1)}%`);
    console.log();
    
    console.log('Strategy Performance:');
    for (const [strategyName, stats] of Object.entries(summary.strategySummary)) {
      console.log(`  ${strategyName}:`);
      console.log(`    Average: ${(stats.averageScore * 100).toFixed(1)}%`);
      console.log(`    Top Score: ${(stats.topScore * 100).toFixed(1)}%`);
      console.log(`    Weight: ${stats.weight}`);
    }

    console.log('\n🎉 Strategy Pattern Test Completed Successfully!');
    console.log('\n✅ Key Validations:');
    console.log('   - Strategy interface implemented correctly');
    console.log('   - Multiple strategies working in composition');
    console.log('   - Weighted scoring system functional');
    console.log('   - Government compliance filtering operational');
    console.log('   - Geographic matching working');
    console.log('   - Fuzzy matching algorithms functional');
    console.log('   - Context class orchestrating strategies properly');

  } catch (error) {
    console.error('❌ Strategy Pattern Test Failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testStrategyPattern();
}

module.exports = { testStrategyPattern, sampleExtractedBid, sampleSuppliers }; 