# Test Email Files (.eml)

This directory contains realistic government contracting email files in standard .eml format for testing our AI-powered email parsing system.

## Test Files Overview

### 1. `sewp-nutanix-rfq.eml` - SEWP V Parser Test
**Purpose**: Tests SEWPParser detection and structured data extraction
**Format**: Highly structured with machine-readable sections
**Key Features**:
- Subject contains "SEWP V RFQ"
- Machine-readable header section with key-value pairs
- Brand restriction (Nutanix only)
- TAA compliance requirements
- Business type requirements (SB150, HUBZone, SDVOSB)
- Structured attachment references

**Expected Parser**: SEWPParser (Factory pattern should detect SEWP content)

### 2. `nasa-networking-rfq.eml` - NASA Parser Test  
**Purpose**: Tests NASAParser detection and specialized NASA requirements
**Format**: NASA-specific structure with space/security requirements
**Key Features**:
- Subject contains "NASA SEWP Team"
- From: nasa.gov domain
- Space-qualified component requirements
- FIPS 140-2 security certifications
- Multiple NASA facility locations
- Federal security clearance requirements

**Expected Parser**: NASAParser (Factory pattern should detect NASA content)

### 3. `gsa-generic-rfi.eml` - Generic Parser Test
**Purpose**: Tests GenericParser fallback for unstructured content
**Format**: Informal, conversational tone without machine-readable sections
**Key Features**:
- Subject contains "GSA Request for Information"
- Less structured format
- General IT infrastructure requirements
- No specific contract vehicle references
- Informal narrative style

**Expected Parser**: GenericParser (Factory pattern fallback for unrecognized formats)

## Testing Strategy

### Factory Pattern Validation
Upload each .eml file to S3 bucket `email-parsing-mvp-619326977873-us-west-1/emails/` to test:

1. **Parser Selection Logic**: 
   - SEWP email → SEWPParser
   - NASA email → NASAParser  
   - GSA email → GenericParser

2. **Event-Driven Flow**:
   ```
   S3 Upload → Lambda Trigger → Factory Pattern → Parser Selection → 
   Bedrock Extraction → EventBridge → SQS → Supplier Matching → API
   ```

3. **Bedrock Integration**:
   Each parser should extract structured JSON with:
   - Items/services requested
   - Quantities and specifications
   - Deadlines and timeline
   - Contact information
   - Requirements and constraints
   - Delivery locations

## Usage Instructions

### Upload Test Files:
```bash
# Upload SEWP test email
aws s3 cp sewp-nutanix-rfq.eml s3://email-parsing-mvp-619326977873-us-west-1/emails/ --region us-west-1

# Upload NASA test email  
aws s3 cp nasa-networking-rfq.eml s3://email-parsing-mvp-619326977873-us-west-1/emails/ --region us-west-1

# Upload Generic test email
aws s3 cp gsa-generic-rfi.eml s3://email-parsing-mvp-619326977873-us-west-1/emails/ --region us-west-1
```

### Monitor Processing:
- Check CloudWatch logs for Lambda function execution
- Query DynamoDB `parsed-emails` table for extracted data
- Test API endpoints for supplier suggestions: `https://4vmhy4gwei.execute-api.us-west-1.amazonaws.com/dev/`

### Expected JSON Output Example (SEWP):
```json
{
  "request_info": {
    "id": "344463",
    "agency_id": "2032H5-25-Q-0016", 
    "type": "Request For Quote",
    "sewp_version": "V"
  },
  "items": [
    {
      "name": "Nutanix Software and Maintenance",
      "brand_restriction": "Nutanix",
      "category": "Software"
    }
  ],
  "deadlines": {
    "reply_deadline": "2025-05-28T15:00:00",
    "qa_cutoff": "2025-05-21T23:59:00"
  },
  "requirements": {
    "taa_compliant": true,
    "authorized_resellers_only": true,
    "business_requirements": ["SB150", "HUBZone", "SDVOSB"]
  }
}
```

## Design Pattern Demonstration

These test files validate our architectural decisions:

- ✅ **Factory Pattern**: Different email formats trigger appropriate parsers
- ✅ **Strategy Pattern**: Supplier matching considers compliance requirements
- ✅ **Event-Driven Architecture**: S3 → EventBridge → SQS → Lambda processing
- ✅ **LLM Integration**: Bedrock Claude extracts structured data from all formats

The variety of formats (structured SEWP, specialized NASA, generic GSA) demonstrates the flexibility of our Factory pattern approach and validates the need for multiple parser implementations in production government contracting systems. 