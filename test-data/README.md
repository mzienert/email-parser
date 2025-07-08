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

### Factory Pattern Validation ✅ **WORKING**
Upload each .eml file to S3 bucket `email-parsing-mvp-619326977873-us-west-2/emails/` to test:

1. **Parser Selection Logic**: ✅ **OPERATIONAL**
   - SEWP email → SEWPParser (1.0 confidence)
   - NASA email → NASAParser (1.0 confidence)  
   - GSA email → GenericParser (0.7 confidence)

2. **Event-Driven Flow**: ✅ **COMPLETE**
   ```
   S3 Upload → Lambda Trigger → Factory Pattern → Parser Selection → 
   Bedrock Extraction → EventBridge → SQS → Supplier Matching → 
   Strategy Pattern → Match Results → DynamoDB + Process Queue
   ```

3. **Bedrock Integration**: ✅ **OPERATIONAL**
   Each parser extracts structured JSON with:
   - Items/services requested
   - Quantities and specifications
   - Deadlines and timeline
   - Contact information
   - Requirements and constraints
   - Delivery locations

4. **Supplier Matching**: ✅ **OPERATIONAL**
   Strategy pattern matching with:
   - ComplianceFilterStrategy (40% weight)
   - FuzzyMatchingStrategy (30% weight)
   - GeographicStrategy (30% weight)
   - Average score: 61.0%, Best match: 63.9%

## Usage Instructions

### Upload Test Files:
```bash
# Upload SEWP test email (from project root)
aws s3 cp test-data/sewp-nutanix-rfq.eml s3://email-parsing-mvp-619326977873-us-west-2/emails/ --region us-west-2

# Upload NASA test email  
aws s3 cp test-data/nasa-networking-rfq.eml s3://email-parsing-mvp-619326977873-us-west-2/emails/ --region us-west-2

# Upload Generic test email
aws s3 cp test-data/gsa-generic-rfi.eml s3://email-parsing-mvp-619326977873-us-west-2/emails/ --region us-west-2

# Or use convenience scripts:
./scripts/upload-sewp-email.sh
./scripts/upload-nasa-email.sh
./scripts/upload-gsa-email.sh
```

### Monitor Processing:
```bash
# Check complete pipeline logs
aws logs tail /aws/lambda/email-processor --region us-west-2 --since 5m
aws logs tail /aws/lambda/email-parser --region us-west-2 --since 5m
aws logs tail /aws/lambda/supplier-matcher --region us-west-2 --since 5m

# Query DynamoDB tables for results
aws dynamodb scan --table-name parsed-emails --region us-west-2
aws dynamodb scan --table-name match-history --region us-west-2
aws dynamodb scan --table-name supplier-catalog --region us-west-2

# Test API endpoints (Phase 4 - ✅ COMPLETE)
curl -X POST "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/suppliers/suggest" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Nutanix software"}],"requirements":{"taaCompliant":true,"businessCertifications":["HUBZone"]},"preferences":{"state":"WV"}}'

curl -X GET "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/emails/sewp-nutanix-rfq/matches"

curl -X POST "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/suppliers/feedback" \
  -H "Content-Type: application/json" \
  -d '{"emailId":"sewp-nutanix-rfq","supplierId":"SUPP-001","feedback":"good_match","rating":4}'
```

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