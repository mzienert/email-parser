# AI-Powered Email Parsing & Supplier Matching System
## Technical Design Document v2.0

### Executive Summary
This document outlines the design for an intelligent email parsing system that uses Large Language Models (LLMs) to extract structured bid data from government contracting emails and provides smart supplier recommendations. The system emphasizes **event-driven architecture** with **Infrastructure as Code** and modern frontend deployment practices.

## 1. System Design Overview

### Architecture Philosophy
- **Event-Driven Microservices**: SQS/EventBridge for loose coupling and scalability
- **Infrastructure as Code**: AWS CDK for repeatable, version-controlled deployments
- **Serverless-First**: AWS Lambda for auto-scaling and cost optimization  
- **AI-Native**: Amazon Bedrock (Claude) for intelligent content extraction
- **Modern Frontend**: React deployed to Vercel for fast iteration
- **Hybrid Approach**: Balance MVP speed with enterprise architecture patterns

### Refined Architecture Flow
```
SES Email Reception → S3 Storage → EventBridge → SQS Queues → Lambda Processors → DynamoDB → API Gateway → React/Vercel UI
```

### Core Components

#### 1.1 Email Ingestion Pipeline
- **AWS SES**: Receives emails from multiple government sources
- **S3 Bucket**: Immutable email storage with lifecycle policies
- **EventBridge**: Central event routing and orchestration
- **SQS Queues**: Reliable message processing with error handling
- **DLQ (Acknowledged)**: Dead letter queues for failed processing (documented, not implemented in MVP)

#### 1.2 Event-Driven Processing Engine  
- **Email Processor Lambda**: Initial email classification and routing
- **Email Parser Lambda**: Content extraction and cleaning
- **Bedrock Integration**: Claude-based structured data extraction
- **Supplier Matcher Lambda**: Item-to-supplier correlation

#### 1.3 Data Layer
- **DynamoDB Tables**: 
  - `parsed-emails`: Structured email data
  - `supplier-catalog`: Supplier information
  - `match-history`: Learning from previous matches
- **API Gateway**: RESTful endpoints for frontend integration

#### 1.4 Frontend Layer
- **React SPA**: Modern email composer with intelligent suggestions
- **Vercel Deployment**: Fast CI/CD with environment-based configuration
- **Real-time Suggestions**: API-driven supplier autocomplete

## 2. LLM Interaction Strategy

### 2.1 Email Content Processing Pipeline

**Event Flow:**
```
Email → S3 Event → EventBridge → Parser Queue → Cleanup Lambda → Bedrock → Extract Queue → Structure Lambda → DynamoDB
```

**Content Cleaning (Generic Approach):**
1. **Format Detection**: HTML vs plain text identification
2. **Header Stripping**: Remove email metadata and routing info
3. **Signature Removal**: Pattern-based signature detection
4. **Forward Chain Parsing**: Extract original content from forwards
5. **Attachment Processing**: Basic text extraction (OCR deferred)

### 2.2 Bedrock Integration

**Structured Extraction Prompt:**
```json
{
  "system": "You are an expert at extracting structured bid information from government contracting emails. Return valid JSON only.",
  "user": "Extract the following from this email:\n- items: Array of requested items/services\n- quantities: Numeric quantities for each item\n- deadlines: Due dates and milestones\n- specifications: Technical requirements\n- contacts: Relevant contact information\n- budget: Budget constraints\n- agency: Contracting agency\n\nEmail content: [CLEANED_EMAIL_CONTENT]"
}
```

**Expected Response Format:**
```json
{
  "items": [
    {
      "name": "Cisco Network Switch",
      "quantity": 5,
      "part_number": "C9300-24T-E",
      "specifications": "24-port Gigabit Ethernet"
    }
  ],
  "deadlines": {
    "submission": "2025-02-15",
    "delivery": "2025-03-30"
  },
  "contacts": [
    {
      "name": "John Smith",
      "email": "john.smith@agency.gov",
      "role": "Contracting Officer"
    }
  ],
  "budget": {
    "estimated": 50000,
    "currency": "USD"
  },
  "agency": "Department of Defense"
}
```

## 3. Supplier Matching Logic

### 3.1 Basic Fuzzy Matching (MVP Implementation)
```python
def calculate_match_score(extracted_item, supplier_item):
    # Token-based similarity
    name_score = fuzzy_ratio(extracted_item.name, supplier_item.name)
    
    # Part number exact match bonus
    part_bonus = 0.3 if extracted_item.part_number == supplier_item.part_number else 0
    
    # Specification keyword matching
    spec_score = keyword_overlap(extracted_item.specifications, supplier_item.capabilities)
    
    return (name_score * 0.5) + part_bonus + (spec_score * 0.2)
```

### 3.2 Advanced Matching (Production Path)
**Acknowledged for future implementation:**
- **Vector Embeddings**: Semantic similarity using OpenSearch
- **Machine Learning**: Historical match success patterns
- **Context-Aware**: Agency-specific supplier preferences
- **Performance Scoring**: Past delivery and quality metrics

## 4. Bid Source Abstraction Design

### 4.1 Generic Parser (MVP)
```typescript
interface BidParser {
  extractFields(emailContent: string, attachments?: Buffer[]): Promise<ExtractedBid>;
  validateExtraction(extracted: ExtractedBid): ValidationResult;
}

class GenericBidParser implements BidParser {
  async extractFields(emailContent: string): Promise<ExtractedBid> {
    // Generic LLM-based extraction for all sources
    return await this.bedrockClient.extract(emailContent);
  }
}
```

### 4.2 Source-Specific Parsers (Acknowledged)
**Existing in-house capabilities noted:**
- **SEWP Parser**: Solutions for Enterprise-Wide Procurement
- **NASA Parser**: NASA-specific solicitation formats  
- **GSA Parser**: General Services Administration bids
- **Agency-Custom**: Department-specific parsing rules

## 5. Infrastructure as Code (AWS CDK)

### 5.1 CDK Stack Structure
```typescript
export class EmailParsingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    // Event infrastructure
    const emailBucket = new s3.Bucket(this, 'EmailStorage');
    const eventBus = new events.EventBus(this, 'EmailEventBus');
    const parseQueue = new sqs.Queue(this, 'EmailParseQueue', {
      deadLetterQueue: { /* DLQ config acknowledged */ }
    });
    
    // Lambda functions
    const emailProcessor = new lambda.Function(this, 'EmailProcessor');
    const supplierMatcher = new lambda.Function(this, 'SupplierMatcher');
    
    // API Gateway
    const api = new apigateway.RestApi(this, 'EmailParsingAPI');
  }
}
```

### 5.2 Event Rules and Targets
```typescript
// Email received → Parse queue
new events.Rule(this, 'EmailReceivedRule', {
  eventBus: eventBus,
  eventPattern: {
    source: ['email.processing'],
    detailType: ['Email Received']
  },
  targets: [new targets.SqsQueue(parseQueue)]
});
```

## 6. Frontend Integration (React/Vercel)

### 6.1 Supplier Suggestion Component
```tsx
export const SupplierAutocomplete: React.FC = () => {
  const [suggestions, setSuggestions] = useState<Supplier[]>([]);
  
  const handleItemInput = async (itemText: string) => {
    const response = await fetch('/api/suppliers/suggest', {
      method: 'POST',
      body: JSON.stringify({ item: itemText })
    });
    setSuggestions(await response.json());
  };
  
  return (
    <Autocomplete
      options={suggestions}
      onInputChange={handleItemInput}
      renderOption={(supplier) => (
        <SupplierCard 
          name={supplier.name}
          contact={supplier.contact}
          matchScore={supplier.confidence}
        />
      )}
    />
  );
};
```

## 7. Cost Analysis & Scaling

### 7.1 Estimated Costs (Low Volume)
- **Claude 3 Haiku**: $0.25 per 1K input tokens
- **Typical Email**: ~500 tokens = $0.125 per email
- **100 emails/day**: ~$12.50/day (~$375/month)
- **Lambda**: ~$0.20 per 1M requests
- **DynamoDB**: Pay-per-request pricing
- **SQS**: $0.40 per 1M requests

### 7.2 Production Scaling Considerations
- **Event batching**: Process multiple emails per Lambda invocation
- **Caching**: Redis for frequent supplier lookups
- **Regional deployment**: Multi-region for government compliance
- **VPC integration**: Secure networking for sensitive data

## 8. Integration with Existing Systems

### 8.1 Acknowledged Existing Capabilities
- **Bid Source Parsers**: SEWP, NASA, GSA-specific extraction logic
- **Supplier Catalog**: Advanced matching and scoring algorithms
- **Email Compose UI**: Existing interface for dropdown integration
- **Authentication**: Current user management and permissions

### 8.2 Integration Points
- **API Compatibility**: RESTful endpoints for existing UI integration
- **Data Format**: JSON schemas compatible with current systems
- **Event Publishing**: EventBridge for system-wide notifications
- **Audit Logging**: CloudTrail integration for compliance

## 9. Implementation Phases

### Phase 1: MVP (12-14 hours)
- ✅ Event-driven email processing
- ✅ Basic supplier matching
- ✅ CDK infrastructure deployment
- ✅ React/Vercel frontend demo

### Phase 2: Production Integration
- ⚠️ Advanced supplier matching algorithms
- ⚠️ Source-specific bid parsers
- ⚠️ Existing UI integration
- ⚠️ Security and compliance hardening

### Phase 3: Enterprise Features
- 📋 Multi-tenant architecture
- 📋 Advanced analytics and reporting
- 📋 Machine learning optimization
- 📋 Government compliance certifications