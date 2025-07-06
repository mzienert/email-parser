# AI-Powered Email Parsing & Supplier Matching System
## Technical Design Document v2.0

### Executive Summary
This document outlines the design for an intelligent email parsing system that uses Large Language Models (LLMs) to extract structured bid data from government contracting emails and provides smart supplier recommendations. The system emphasizes **event-driven architecture** with **Infrastructure as Code** and modern frontend deployment practices.

**Domain Validation**: This design is informed by comprehensive analysis of real government procurement documents (see [`sample_doc_analysis/`](./sample_doc_analysis/)), including a 37-page SEWP V RFQ with 52 FAR clauses, confirming the complexity requires both specialized parsing strategies and flexible supplier matching algorithms.

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
- **Email Parser Lambda**: Content extraction, cleaning, and **Bedrock integration**
- **Bedrock Service**: Claude-based structured data extraction for all parser types
- **Supplier Matcher Lambda**: Item-to-supplier correlation with strategy pattern

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

**Real-World SEWP Example** (from IRS ESAT SOW analysis):
```json
{
  "items": [
    {
      "clin": "0001",
      "name": "Nutanix Cloud Infrastructure Ultimate License",
      "part_number": "SW-NCI-ULT-FP",
      "quantity": 5152,
      "unit": "CPU Core",
      "period": "1 year"
    },
    {
      "clin": "0008", 
      "name": "Nutanix Unified Storage Pro License",
      "part_number": "SW-NUS-PRO-FP",
      "quantity": 882,
      "unit": "TiB data stored",
      "period": "1 year"
    }
  ],
  "technical_context": {
    "mission": "IRS Cybersecurity ESAT",
    "integration": ["Guardium", "Splunk"],
    "infrastructure": "Hyper-Converged Infrastructure"
  },
  "compliance_requirements": {
    "taa_compliance": "mandatory",
    "authorized_reseller": "Nutanix required",
    "support_level": "24/7 Federal Production"
  },
  "delivery": {
    "physical_location": "ECC-Martinsburg, Kearneysville, WV",
    "virtual_contacts": [
      "Angela.r.sensel@irs.gov",
      "Peter.a.seranko@irs.gov"
    ]
  },
  "performance_period": "12 months from award"
}
```

## 3. Supplier Matching Logic - Strategy Pattern Implementation

### 3.1 Strategy Pattern Architecture
```typescript
interface IMatchingStrategy {
  calculateScore(extractedItem: ExtractedItem, supplier: Supplier): Promise<MatchScore>;
  getStrategyName(): string;
  getWeight(): number;
}

class SupplierMatcher {
  private strategies: IMatchingStrategy[] = [];

  constructor() {
    this.strategies = [
      new FuzzyMatchingStrategy(),
      new ComplianceFilterStrategy(),
      new GeographicStrategy(),
      new BrandAuthorizationStrategy()
    ];
  }

  async findMatches(extractedItems: ExtractedItem[], suppliers: Supplier[]): Promise<SupplierMatch[]> {
    const matches: SupplierMatch[] = [];

    for (const item of extractedItems) {
      for (const supplier of suppliers) {
        const combinedScore = await this.calculateCombinedScore(item, supplier);
        if (combinedScore.totalScore > 0.6) {
          matches.push({
            supplier,
            item,
            score: combinedScore,
            strategies: combinedScore.strategyScores
          });
        }
      }
    }

    return matches.sort((a, b) => b.score.totalScore - a.score.totalScore);
  }

  private async calculateCombinedScore(item: ExtractedItem, supplier: Supplier): Promise<CombinedScore> {
    const strategyScores: StrategyScore[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const strategy of this.strategies) {
      const score = await strategy.calculateScore(item, supplier);
      const weight = strategy.getWeight();
      
      strategyScores.push({
        strategy: strategy.getStrategyName(),
        score: score.value,
        confidence: score.confidence,
        factors: score.factors
      });

      weightedSum += score.value * weight;
      totalWeight += weight;
    }

    return {
      totalScore: weightedSum / totalWeight,
      strategyScores,
      confidence: Math.min(...strategyScores.map(s => s.confidence))
    };
  }
}
```

### 3.2 Fuzzy Matching Strategy
```typescript
class FuzzyMatchingStrategy implements IMatchingStrategy {
  async calculateScore(extractedItem: ExtractedItem, supplier: Supplier): Promise<MatchScore> {
    // Token-based similarity for item names
    const nameScore = this.calculateNameSimilarity(extractedItem.name, supplier.productCategories);
    
    // Part number exact match bonus
    const partNumberBonus = this.hasPartNumberMatch(extractedItem.partNumber, supplier.partNumbers) ? 0.3 : 0;
    
    // Specification keyword overlap
    const specScore = this.calculateSpecificationOverlap(extractedItem.specifications, supplier.capabilities);
    
    const finalScore = (nameScore * 0.5) + partNumberBonus + (specScore * 0.2);
    
    return {
      value: Math.min(finalScore, 1.0),
      confidence: nameScore > 0.7 ? 0.9 : 0.6,
      factors: {
        nameMatch: nameScore,
        partNumberMatch: partNumberBonus > 0,
        specificationOverlap: specScore
      }
    };
  }

  getStrategyName(): string {
    return 'FuzzyMatching';
  }

  getWeight(): number {
    return 0.4; // 40% weight in final score
  }
}
```

### 3.3 Compliance Filter Strategy
```typescript
class ComplianceFilterStrategy implements IMatchingStrategy {
  async calculateScore(extractedItem: ExtractedItem, supplier: Supplier): Promise<MatchScore> {
    const requirements = extractedItem.requirements;
    let complianceScore = 0;
    const factors: any = {};

    // TAA Compliance check
    if (requirements.taaCompliant && supplier.certifications.taaCompliant) {
      complianceScore += 0.3;
      factors.taaCompliant = true;
    } else if (requirements.taaCompliant && !supplier.certifications.taaCompliant) {
      return { value: 0, confidence: 1.0, factors: { taaCompliant: false } }; // Disqualified
    }

    // EPEAT certification check
    if (requirements.epeaLevels && this.hasEPEATMatch(requirements.epeaLevels, supplier.certifications.epeaLevels)) {
      complianceScore += 0.2;
      factors.epeaCompliant = true;
    }

    // Business type requirements (SB150, HUBZone, SDVOSB)
    if (requirements.businessRequirements) {
      const businessMatch = this.checkBusinessTypeMatch(requirements.businessRequirements, supplier.businessType);
      complianceScore += businessMatch * 0.3;
      factors.businessTypeMatch = businessMatch;
    }

    // Brand authorization check
    if (requirements.brandRestrictions) {
      const brandAuth = this.checkBrandAuthorization(requirements.brandRestrictions, supplier.brandAuthorizations);
      if (!brandAuth) {
        return { value: 0, confidence: 1.0, factors: { brandAuthorization: false } }; // Disqualified
      }
      complianceScore += 0.2;
      factors.brandAuthorization = true;
    }

    return {
      value: Math.min(complianceScore, 1.0),
      confidence: 0.95, // High confidence in compliance checks
      factors
    };
  }

  getStrategyName(): string {
    return 'ComplianceFilter';
  }

  getWeight(): number {
    return 0.4; // 40% weight - compliance is critical for government contracts
  }
}
```

### 3.4 Geographic Strategy
```typescript
class GeographicStrategy implements IMatchingStrategy {
  async calculateScore(extractedItem: ExtractedItem, supplier: Supplier): Promise<MatchScore> {
    const deliveryLocation = extractedItem.deliveryLocation;
    let geoScore = 0;

    // Local/regional preference
    if (this.isLocalSupplier(deliveryLocation, supplier.location)) {
      geoScore += 0.3;
    }

    // Service area coverage
    if (this.coversServiceArea(deliveryLocation, supplier.serviceAreas)) {
      geoScore += 0.4;
    }

    // CONUS requirement
    if (extractedItem.requirements.conusOnly && supplier.location.conus) {
      geoScore += 0.3;
    }

    return {
      value: Math.min(geoScore, 1.0),
      confidence: 0.8,
      factors: {
        localPreference: this.isLocalSupplier(deliveryLocation, supplier.location),
        serviceAreaCoverage: this.coversServiceArea(deliveryLocation, supplier.serviceAreas),
        conusCompliant: supplier.location.conus
      }
    };
  }

  getStrategyName(): string {
    return 'Geographic';
  }

  getWeight(): number {
    return 0.2; // 20% weight
  }
}
```

### 3.5 Advanced Matching (Production Enhancement Path)
**Future Strategy Implementations:**
- **VectorEmbeddingStrategy**: Semantic similarity using OpenSearch vector search
- **HistoricalPerformanceStrategy**: Past contract success patterns and delivery performance
- **AgencyPreferenceStrategy**: Agency-specific supplier preferences and past relationships
- **MarketAnalysisStrategy**: Competitive pricing and market position analysis

## 4. Bid Source Abstraction Design - Factory Pattern Implementation

### 4.1 Factory Pattern Architecture
```typescript
interface IBidParser {
  extractFields(emailContent: string, attachments?: Buffer[]): Promise<ExtractedBid>;
  validateExtraction(extracted: ExtractedBid): ValidationResult;
  getSourceType(): BidSourceType;
}

enum BidSourceType {
  SEWP = 'SEWP',
  NASA = 'NASA', 
  GSA = 'GSA',
  GENERIC = 'GENERIC'
}

class BidParserFactory {
  static createParser(emailContent: string, bedrockClient: BedrockClient): IBidParser {
    const sourceType = this.detectSourceType(emailContent);
    
    switch (sourceType) {
      case BidSourceType.SEWP:
        return new SEWPParser(bedrockClient);
      case BidSourceType.NASA:
        return new NASAParser(bedrockClient);
      case BidSourceType.GSA:
        return new GSAParser(bedrockClient);
      default:
        return new GenericParser(bedrockClient);
    }
  }

  private static detectSourceType(emailContent: string): BidSourceType {
    if (emailContent.includes('SEWP V QRT Tool')) return BidSourceType.SEWP;
    if (emailContent.includes('NASA SEWP Team')) return BidSourceType.NASA;
    if (emailContent.includes('GSA')) return BidSourceType.GSA;
    return BidSourceType.GENERIC;
  }
}
```

### 4.2 SEWP Parser Implementation (Bedrock + Rule-Based Hybrid)
```typescript
class SEWPParser implements IBidParser {
  constructor(private bedrockClient: BedrockClient) {}

  async extractFields(emailContent: string, attachments?: Buffer[]): Promise<ExtractedBid> {
    // Step 1: Rule-based extraction of machine-readable section
    const machineReadableSection = this.extractMachineReadableSection(emailContent);
    const structuredData = this.parseStructuredSEWPData(machineReadableSection);
    
    // Step 2: Bedrock extraction for complex content and attachments
    const cleanedContent = this.cleanEmailContent(emailContent);
    const bedrockExtraction = await this.extractWithBedrock(cleanedContent, attachments);
    
    // Step 3: Merge rule-based and AI-extracted data with SEWP-specific validation
    return this.mergeAndValidateSEWPData(structuredData, bedrockExtraction);
  }

  private async extractWithBedrock(cleanedContent: string, attachments?: Buffer[]): Promise<Partial<ExtractedBid>> {
    const sewpPrompt = `You are extracting structured data from a SEWP V government contracting email. Pay special attention to:
    - CLIN (Contract Line Item Numbers) and associated products
    - TAA compliance requirements
    - HUBZone, SDVOSB, and other business type requirements
    - Brand authorization requirements (especially for Nutanix, Cisco, etc.)
    - Security compliance levels (Core, CSAT, CNET, CSOFT)
    - Technical specifications requiring enterprise-grade licensing
    
    Extract the following JSON structure:
    ${JSON.stringify(this.getSEWPExtractionSchema())}
    
    Email content: ${cleanedContent}`;

    const response = await this.bedrockClient.invoke({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        system: 'You are an expert at extracting structured bid information from SEWP government contracting emails. Return valid JSON only.',
        messages: [{ role: 'user', content: sewpPrompt }]
      })
    });

    return JSON.parse(response.body);
  }

  private mergeAndValidateSEWPData(structuredData: any, bedrockData: Partial<ExtractedBid>): ExtractedBid {
    // Prioritize rule-based extraction for structured fields, use Bedrock for complex analysis
    return {
      requestInfo: {
        id: structuredData.requestId || bedrockData.requestInfo?.id,
        agencyId: structuredData.agencyId || bedrockData.requestInfo?.agencyId,
        type: structuredData.requestType || bedrockData.requestInfo?.type,
        sewpVersion: structuredData.sewpVersion || 'V'
      },
      items: this.mergeSEWPItems(structuredData.items, bedrockData.items),
      deadlines: bedrockData.deadlines || this.parseSEWPDeadlines(structuredData),
      contacts: bedrockData.contacts || this.parseSEWPContacts(structuredData),
      requirements: this.enhanceSEWPRequirements(structuredData, bedrockData.requirements),
      attachments: bedrockData.attachments || []
    };
  }

  private getSEWPExtractionSchema() {
    return {
      items: [
        {
          clin: "Contract Line Item Number",
          name: "Product/service name",
          part_number: "Manufacturer part number",
          quantity: "Numeric quantity",
          unit: "Unit of measure (CPU Core, TiB, etc.)",
          period: "Performance period"
        }
      ],
      technical_context: {
        mission: "Agency mission context",
        integration: ["Existing systems to integrate with"],
        infrastructure: "Infrastructure type"
      },
      compliance_requirements: {
        taa_compliance: "TAA compliance requirement",
        authorized_reseller: "Brand authorization requirements",
        support_level: "Required support level"
      }
    };
  }

  getSourceType(): BidSourceType {
    return BidSourceType.SEWP;
  }
}
```

### 4.3 NASA Parser Implementation (Bedrock + NASA-Specific Logic)
```typescript
class NASAParser implements IBidParser {
  constructor(private bedrockClient: BedrockClient) {}

  async extractFields(emailContent: string, attachments?: Buffer[]): Promise<ExtractedBid> {
    // Step 1: NASA-specific preprocessing
    const cleanedContent = this.cleanNASAEmailContent(emailContent);
    
    // Step 2: Bedrock extraction with NASA context
    const nasaPrompt = `You are extracting structured data from a NASA SEWP contracting email. Pay special attention to:
    - NASA mission-specific requirements
    - Space-grade equipment specifications
    - Security clearance requirements
    - NASA supplier qualification standards
    - Technical specifications for aerospace applications
    
    Extract the following JSON structure:
    ${JSON.stringify(this.getNASAExtractionSchema())}
    
    Email content: ${cleanedContent}`;

    const response = await this.bedrockClient.invoke({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        system: 'You are an expert at extracting structured bid information from NASA government contracting emails. Return valid JSON only.',
        messages: [{ role: 'user', content: nasaPrompt }]
      })
    });

    const bedrockData = JSON.parse(response.body);
    
    // Step 3: NASA-specific validation and enhancement
    return this.validateAndEnhanceNASAData(bedrockData);
  }

  getSourceType(): BidSourceType {
    return BidSourceType.NASA;
  }
}
```

### 4.4 Generic Parser (Pure Bedrock for Unknown Sources)
```typescript
class GenericParser implements IBidParser {
  constructor(private bedrockClient: BedrockClient) {}

  async extractFields(emailContent: string, attachments?: Buffer[]): Promise<ExtractedBid> {
    // Pure Bedrock extraction for unknown email formats
    const cleanedContent = this.cleanGenericEmailContent(emailContent);
    const prompt = this.buildGenericExtractionPrompt(cleanedContent);
    
    const response = await this.bedrockClient.invoke({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        system: 'You are an expert at extracting structured bid information from government contracting emails. Return valid JSON only.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const bedrockData = JSON.parse(response.body);
    return this.validateAndStructureGenericData(bedrockData);
  }

  private buildGenericExtractionPrompt(emailContent: string): string {
    return `Extract the following from this government contracting email:
    - items: Array of requested items/services with quantities
    - deadlines: Due dates and milestones
    - specifications: Technical requirements
    - contacts: Relevant contact information
    - budget: Budget constraints
    - agency: Contracting agency
    - requirements: Compliance requirements (TAA, business types, etc.)
    
    Return a JSON object with this structure:
    ${JSON.stringify(this.getGenericExtractionSchema())}
    
    Email content: ${emailContent}`;
  }

  getSourceType(): BidSourceType {
    return BidSourceType.GENERIC;
  }
}
```

### 4.5 Lambda Function Integration (Complete Bedrock Flow)
```typescript
// Email Parser Lambda - Main processing function
export const handler = async (event: SQSEvent): Promise<void> => {
  const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
  
  for (const record of event.Records) {
    try {
      const emailData = JSON.parse(record.body);
      
      // Step 1: Create appropriate parser with Bedrock client
      const parser = BidParserFactory.createParser(emailData.content, bedrockClient);
      
      // Step 2: Extract fields using parser-specific logic + Bedrock
      const extractedBid = await parser.extractFields(
        emailData.content, 
        emailData.attachments
      );
      
      // Step 3: Validate extraction quality
      const validation = await parser.validateExtraction(extractedBid);
      if (!validation.isValid) {
        await this.handleExtractionError(emailData, validation.errors);
        continue;
      }
      
      // Step 4: Store results and trigger supplier matching
      await this.storeExtractedBid(extractedBid);
      await this.triggerSupplierMatching(extractedBid);
      
    } catch (error) {
      console.error('Email processing failed:', error);
      // Send to DLQ for manual review
      await this.sendToDeadLetterQueue(record, error);
    }
  }
};

// Bedrock client helper for consistent configuration
class BedrockService {
  private client: BedrockRuntimeClient;
  
  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }
  
  async extractWithClaude(prompt: string, systemMessage: string): Promise<any> {
    const response = await this.client.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        system: systemMessage,
        messages: [{ role: 'user', content: prompt }]
      })
    }));
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return JSON.parse(responseBody.content[0].text);
  }
}
```

### 4.6 Integration with Existing Systems
**Production Enhancement Path:**
- **Existing SEWP Parser**: Enhanced version with complete field extraction
- **NASA Parser**: Integration with NASA-specific solicitation processing
- **GSA Parser**: General Services Administration bid handling
- **Factory Extension**: Easy addition of new parser types through interface implementation
- **Bedrock Optimization**: Model fine-tuning with government contracting corpus

## 5. Infrastructure as Code (AWS CDK)

### 5.1 CDK Stack Structure (with Bedrock Integration)
```typescript
export class EmailParsingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    // Event infrastructure
    const emailBucket = new s3.Bucket(this, 'EmailStorage');
    const eventBus = new events.EventBus(this, 'EmailEventBus');
    const parseQueue = new sqs.Queue(this, 'EmailParseQueue', {
      deadLetterQueue: { /* DLQ config acknowledged */ }
    });
    
    // Lambda functions with Bedrock permissions
    const emailProcessor = new lambda.Function(this, 'EmailProcessor', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'email-parser.handler',
      code: lambda.Code.fromAsset('dist'),
      timeout: Duration.minutes(5),
      memorySize: 1024,
      environment: {
        BEDROCK_REGION: 'us-east-1',
        BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0'
      }
    });
    
    // Grant Bedrock permissions to Lambda
    emailProcessor.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream'
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`
      ]
    }));
    
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

### 7.1 Estimated Costs (Low Volume) - Bedrock Integration
- **Claude 3 Haiku (Bedrock)**: $0.25 per 1K input tokens, $1.25 per 1K output tokens
- **Typical Email Processing**: 
  - Input: ~800 tokens (email + prompt) = $0.20
  - Output: ~200 tokens (structured JSON) = $0.25
  - **Total per email**: ~$0.45
- **100 emails/day**: ~$45/day (~$1,350/month)
- **Lambda (5min timeout)**: ~$0.83 per 1K requests (increased for Bedrock processing)
- **DynamoDB**: Pay-per-request pricing
- **SQS**: $0.40 per 1M requests
- **S3**: $0.023 per GB storage for email archives

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

### Phase 1: MVP (15-17 hours)
- ✅ Event-driven email processing
- ✅ Factory pattern parser implementation
- ✅ Strategy pattern supplier matching
- ✅ CDK infrastructure deployment
- ✅ React/Vercel frontend demo

### Phase 2: Production Integration
- ⚠️ Enhanced parser implementations (full SEWP/NASA logic)
- ⚠️ Advanced matching strategies (ML, vector embeddings)
- ⚠️ Existing UI integration
- ⚠️ Security and compliance hardening

### Phase 3: Enterprise Features
- 📋 Multi-tenant architecture
- 📋 Advanced analytics and reporting
- 📋 Machine learning optimization
- 📋 Government compliance certifications