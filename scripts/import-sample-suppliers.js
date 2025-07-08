#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

// Configure AWS SDK
const client = new DynamoDBClient({ region: 'us-west-2' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'supplier-catalog';

// Sample supplier data for government contracting
const sampleSuppliers = [
  {
    supplierId: 'SUPP-001-NUTANIX-RESELLER',
    companyName: 'Federal Tech Solutions LLC',
    duns: '123456789',
    cageCode: '1A2B3',
    contact: {
      primaryContact: {
        name: 'John Smith',
        title: 'Government Sales Director',
        email: 'john.smith@federaltech.com',
        phone: '555-123-4567'
      },
      technicalContact: {
        name: 'Sarah Johnson',
        title: 'Technical Lead',
        email: 'sarah.johnson@federaltech.com',
        phone: '555-123-4568'
      },
      contractsContact: {
        name: 'Mike Davis',
        title: 'Contracts Manager',
        email: 'mike.davis@federaltech.com',
        phone: '555-123-4569'
      }
    },
    businessCertifications: ['HUBZone', 'SDVOSB'],
    complianceStatus: 'FULL_COMPLIANT',
    complianceDetails: {
      taaCompliant: true,
      epeatLevels: ['Bronze', 'Silver', 'Gold'],
      securityClearance: ['C', 'CSAT'],
      federalContractHistory: true,
      governmentCertifications: ['FedRAMP', 'FISMA']
    },
    capabilities: ['NUTANIX_RESELLER', 'HYPER_CONVERGED_INFRASTRUCTURE', '24_7_SUPPORT'],
    authorizedReseller: {
      nutanix: true,
      cisco: true,
      dell: false,
      hp: false,
      microsoft: true,
      vmware: true
    },
    geographicCapabilities: {
      state: 'WV',
      regions: ['Mid-Atlantic', 'Southeast'],
      deliveryLocations: ['West Virginia', 'Maryland', 'Virginia', 'Pennsylvania'],
      supportCoverage: '24/7 Federal'
    },
    pastPerformance: {
      governmentContracts: [
        {
          contractNumber: 'SEWP-V-123456',
          agency: 'IRS',
          value: 2500000,
          performancePeriod: '2022-2024',
          rating: 'Exceptional'
        }
      ],
      sewpExperience: true,
      nasaExperience: false,
      gsaSchedule: '70-SIN-1234567'
    },
    businessInfo: {
      businessSize: 'Small',
      employeeCount: 75,
      annualRevenue: 15000000,
      foundedYear: 2018,
      headquarters: {
        address: '1234 Tech Drive',
        city: 'Charleston',
        state: 'WV',
        zip: '25301'
      }
    },
    technicalCapabilities: {
      supportLevel: '24/7 Federal',
      installationCapability: true,
      maintenanceCapability: true,
      trainingCapability: true,
      customizationCapability: false
    },
    metadata: {
      createdAt: '2025-01-15T10:30:00Z',
      updatedAt: '2025-01-15T10:30:00Z',
      lastVerified: '2025-01-15T10:30:00Z',
      dataSource: 'manual',
      status: 'active'
    }
  },
  {
    supplierId: 'SUPP-002-NUTANIX-LARGE',
    companyName: 'Enterprise Government Solutions Inc',
    duns: '987654321',
    cageCode: '5F6G7',
    contact: {
      primaryContact: {
        name: 'Amanda Wilson',
        title: 'Federal Sales Manager',
        email: 'amanda.wilson@enterprisegov.com',
        phone: '555-987-6543'
      },
      technicalContact: {
        name: 'Robert Chen',
        title: 'Senior Solutions Architect',
        email: 'robert.chen@enterprisegov.com',
        phone: '555-987-6544'
      },
      contractsContact: {
        name: 'Lisa Rodriguez',
        title: 'Government Contracts Director',
        email: 'lisa.rodriguez@enterprisegov.com',
        phone: '555-987-6545'
      }
    },
    businessCertifications: ['8(a)', 'WOSB'],
    complianceStatus: 'FULL_COMPLIANT',
    complianceDetails: {
      taaCompliant: true,
      epeatLevels: ['Bronze', 'Silver', 'Gold'],
      securityClearance: ['C', 'CSAT', 'CNET'],
      federalContractHistory: true,
      governmentCertifications: ['FedRAMP', 'FISMA', 'NIST']
    },
    capabilities: ['NUTANIX_RESELLER', 'HYPER_CONVERGED_INFRASTRUCTURE', 'PROFESSIONAL_SERVICES'],
    authorizedReseller: {
      nutanix: true,
      cisco: true,
      dell: true,
      hp: true,
      microsoft: true,
      vmware: true
    },
    geographicCapabilities: {
      state: 'NJ',
      regions: ['Mid-Atlantic', 'Northeast'],
      deliveryLocations: ['New Jersey', 'New York', 'Pennsylvania', 'Delaware'],
      supportCoverage: '24/7 Federal'
    },
    pastPerformance: {
      governmentContracts: [
        {
          contractNumber: 'SEWP-V-789012',
          agency: 'Treasury',
          value: 5000000,
          performancePeriod: '2021-2025',
          rating: 'Very Good'
        }
      ],
      sewpExperience: true,
      nasaExperience: true,
      gsaSchedule: '70-SIN-9876543'
    },
    businessInfo: {
      businessSize: 'Large',
      employeeCount: 250,
      annualRevenue: 45000000,
      foundedYear: 2015,
      headquarters: {
        address: '789 Federal Plaza',
        city: 'Trenton',
        state: 'NJ',
        zip: '08608'
      }
    },
    technicalCapabilities: {
      supportLevel: '24/7 Federal',
      installationCapability: true,
      maintenanceCapability: true,
      trainingCapability: true,
      customizationCapability: true
    },
    metadata: {
      createdAt: '2025-01-15T11:00:00Z',
      updatedAt: '2025-01-15T11:00:00Z',
      lastVerified: '2025-01-15T11:00:00Z',
      dataSource: 'manual',
      status: 'active'
    }
  },
  {
    supplierId: 'SUPP-003-NUTANIX-HUBZONE',
    companyName: 'Mountain State Technology Partners',
    duns: '456789123',
    cageCode: '8H9J0',
    contact: {
      primaryContact: {
        name: 'David Thompson',
        title: 'CEO',
        email: 'david.thompson@mstechpartners.com',
        phone: '555-456-7890'
      },
      technicalContact: {
        name: 'Jennifer Martinez',
        title: 'CTO',
        email: 'jennifer.martinez@mstechpartners.com',
        phone: '555-456-7891'
      },
      contractsContact: {
        name: 'Kevin Brown',
        title: 'Business Development',
        email: 'kevin.brown@mstechpartners.com',
        phone: '555-456-7892'
      }
    },
    businessCertifications: ['HUBZone'],
    complianceStatus: 'TAA_COMPLIANT',
    complianceDetails: {
      taaCompliant: true,
      epeatLevels: ['Bronze', 'Silver'],
      securityClearance: ['C'],
      federalContractHistory: true,
      governmentCertifications: ['FISMA']
    },
    capabilities: ['NUTANIX_RESELLER', 'REGIONAL_SUPPORT'],
    authorizedReseller: {
      nutanix: true,
      cisco: false,
      dell: false,
      hp: false,
      microsoft: false,
      vmware: false
    },
    geographicCapabilities: {
      state: 'WV',
      regions: ['Southeast'],
      deliveryLocations: ['West Virginia', 'Kentucky', 'Virginia'],
      supportCoverage: 'Business Hours'
    },
    pastPerformance: {
      governmentContracts: [
        {
          contractNumber: 'SEWP-V-345678',
          agency: 'IRS',
          value: 750000,
          performancePeriod: '2023-2024',
          rating: 'Satisfactory'
        }
      ],
      sewpExperience: true,
      nasaExperience: false,
      gsaSchedule: '70-SIN-4567890'
    },
    businessInfo: {
      businessSize: 'Small',
      employeeCount: 25,
      annualRevenue: 3000000,
      foundedYear: 2020,
      headquarters: {
        address: '567 Mountain View Road',
        city: 'Kearneysville',
        state: 'WV',
        zip: '25430'
      }
    },
    technicalCapabilities: {
      supportLevel: 'Business Hours',
      installationCapability: true,
      maintenanceCapability: false,
      trainingCapability: false,
      customizationCapability: false
    },
    metadata: {
      createdAt: '2025-01-15T11:30:00Z',
      updatedAt: '2025-01-15T11:30:00Z',
      lastVerified: '2025-01-15T11:30:00Z',
      dataSource: 'manual',
      status: 'active'
    }
  }
];

// Function to add GSI attributes for each supplier
function addGSIAttributes(supplier) {
  const gsiSupplier = { ...supplier };
  
  // Add individual capabilities as separate records for GSI
  gsiSupplier.capability = supplier.capabilities[0]; // Primary capability for GSI
  
  // Add individual business certifications as separate records for GSI
  gsiSupplier.businessCertification = supplier.businessCertifications[0]; // Primary certification for GSI
  
  return gsiSupplier;
}

// Import function
async function importSuppliers() {
  console.log('Starting supplier data import...');
  
  try {
    for (const supplier of sampleSuppliers) {
      const supplierWithGSI = addGSIAttributes(supplier);
      
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: supplierWithGSI
      });
      
      await docClient.send(command);
      console.log(`✅ Imported: ${supplier.companyName} (${supplier.supplierId})`);
    }
    
    console.log(`\n🎉 Successfully imported ${sampleSuppliers.length} suppliers!`);
    console.log('\nSupplier Summary:');
    console.log('- 3 Nutanix authorized resellers');
    console.log('- Business certifications: HUBZone, SDVOSB, 8(a), WOSB');
    console.log('- Geographic coverage: WV, NJ regions');
    console.log('- Full compliance and TAA compliance suppliers');
    console.log('- Small and large business sizes');
    console.log('- SEWP V experience validated');
    
  } catch (error) {
    console.error('❌ Error importing suppliers:', error);
    process.exit(1);
  }
}

// Run the import
if (require.main === module) {
  importSuppliers();
}

module.exports = { importSuppliers, sampleSuppliers }; 