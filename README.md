# AI-Powered Government Email Parsing System

An intelligent email parsing and supplier autofill system designed for government contracting platforms, featuring AWS serverless architecture and advanced LLM-powered content extraction.

## Project Overview

This system addresses the challenge of processing complex government contracting emails (RFQs, RFPs, solicitations) and automatically suggesting qualified suppliers. Built for a technical assessment demonstrating enterprise-level AWS architecture while respecting existing system capabilities.

### **Core Capabilities**
- **Intelligent Email Parsing**: LLM-powered extraction of structured bid data from unstructured government emails
- **Smart Supplier Matching**: Multi-strategy algorithms for supplier suggestions based on compliance, geography, and capabilities
- **Event-Driven Architecture**: Scalable AWS serverless processing pipeline with SQS and EventBridge
- **Factory Pattern Parsers**: Specialized handling for different procurement systems (SEWP, NASA, GSA)
- **Strategy Pattern Matching**: Flexible supplier matching with configurable algorithms

## Architecture Highlights

### **Event-Driven Processing Pipeline**
```
SES → S3 → EventBridge → SQS → Lambda → DynamoDB → API Gateway → React UI
```

### **Design Patterns Implementation**
- **Factory Pattern**: `SEWPParser`, `NASAParser`, `GenericParser` for specialized email formats
- **Strategy Pattern**: `FuzzyMatchingStrategy`, `ComplianceFilterStrategy`, `GeographicStrategy` for supplier matching
- **Publisher-Subscriber**: EventBridge for decoupled system integration

### **Technology Stack**
- **Backend**: AWS Lambda (Node.js/TypeScript), Amazon Bedrock (Claude), DynamoDB
- **Infrastructure**: AWS CDK for Infrastructure as Code
- **Frontend**: React TypeScript deployed on Vercel
- **Processing**: SQS queues, EventBridge events, S3 storage

## Government Contracting Domain Complexity

### **Sample Analysis Insights**
Based on comprehensive analysis of real SEWP V procurement documents (IRS Nutanix Software RFQ):

- **Complete Document Ecosystem**: Email (5%), RFQ PDF (75%), Pricing Template (15%), Q&A Template (5%)
- **Email Structure**: Machine-readable sections with basic overview and contact information
- **PDF Complexity**: 37-page RFQ with 52 FAR clauses, technical specifications, and compliance requirements
- **Pricing Intelligence**: Structured CLIN-based commercial data with TAA compliance verification
- **Communication Intelligence**: Q&A templates for requirement clarification and amendment tracking
- **Compliance Requirements**: TAA, EPEAT, Security levels (C, CSAT, CNET, CSOFT)
- **Business Certifications**: HUBZone, SDVOSB, Small Business set-asides
- **Evaluation Methods**: LPTA (Lowest Price Technically Acceptable) with multi-document submission requirements

### **Strategic Approach**
- **MVP Focus**: Email-level parsing and basic supplier matching (achievable in assessment timeframe)
- **Production Path**: Complete multi-document processing (PDF, Excel, Q&A), compliance engines, workflow integration
- **Integration Strategy**: Respect existing specialized systems while demonstrating comprehensive architectural understanding

## Project Documentation

### **Technical Documentation**
- [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md) - Complete system architecture and implementation details
- [`PROJECT_BLUEPRINT.md`](./PROJECT_BLUEPRINT.md) - Implementation phases and project tracking
- [`CONVERSATION_SUMMARY.md`](./CONVERSATION_SUMMARY.md) - Problem-solving process and decision rationale

### **Sample Analysis**
- [`sample_doc_analysis/`](./sample_doc_analysis/) - Detailed analysis of government contracting documents
  - **Email Analysis**: SEWP email structure and parsing requirements
  - **PDF Analysis**: Full RFQ document complexity and production implications
  - **Strategic Insights**: Architecture validation and technology requirements

### **Test Data**
- [`sample_docs/`](./sample_docs/) - Real government procurement emails and attachments for testing

## Implementation Status

### **Phase 1: Infrastructure Setup (Hours 1-2)** ✅ **COMPLETE**
- ✅ **AWS CDK Deployment**: S3, EventBridge, SQS, DynamoDB, Lambda, API Gateway
- ✅ **Event-Driven Architecture**: Complete serverless pipeline operational
- ✅ **Bedrock Integration**: Claude 3.7 Sonnet, Claude Sonnet 4, Claude Opus 4 configured
- ✅ **Test Data Pipeline**: Direct S3 upload with .eml processing

### **Phase 2: Event-Driven Email Processing (Hours 3-6)** ✅ **COMPLETE**
- ✅ **Factory Pattern Implementation**: SEWPParser, NASAParser, GenericParser
- ✅ **Hybrid LLM Integration**: Rule-based + Bedrock extraction (5-7s processing)
- ✅ **Email Ingestion**: S3 → Lambda → EventBridge → SQS flow operational
- ✅ **BedrockClient Architecture**: Production-ready LLM integration with error handling

### **Phase 3: Supplier Matching Pipeline (Hours 7-9)** ✅ **COMPLETE**
- ✅ **Strategy Pattern Implementation**: ComplianceFilterStrategy, FuzzyMatchingStrategy, GeographicStrategy
- ✅ **Multi-Algorithm Scoring**: 61.0% average, 63.9% best match (Federal Tech Solutions LLC)
- ✅ **Government Compliance Intelligence**: TAA compliance, business certifications, geographic matching
- ✅ **End-to-End Pipeline**: Email → Parser → Supplier Matcher → Results (150-415ms)
- ✅ **Production Integration**: DynamoDB persistence, EventBridge events, SQS processing

### **Phase 4: API Gateway & Endpoints (Hours 10-11)** ✅ **COMPLETE**
- ✅ **REST API Endpoints**: POST /suppliers/suggest, GET /emails/{id}/matches, POST /suppliers/feedback
- ✅ **Real-time Supplier Suggestions**: Intelligent scoring with compliance and geographic filtering
- ✅ **Match History API**: Complete supplier match results with strategy breakdowns
- ✅ **Feedback Collection**: User feedback system for continuous improvement
- ✅ **Production Integration**: Full AWS Lambda + API Gateway + DynamoDB integration

### **Phase 5: React Frontend (Hours 12-13)** ⏳ **NEXT**
- [ ] Email composer UI with intelligent supplier suggestions  
- [ ] Real-time API integration with supplier filtering
- [ ] Match confidence display and supplier contact information
- [ ] Vercel deployment with production-ready UI/UX

### **Future Phases**
- **Phase 6**: Testing & Documentation (comprehensive system validation)
- **Phase 7**: Advanced document processing (PDF parsing, Excel integration)
- **Phase 8**: Compliance engine (FAR clause interpretation, certification verification)
- **Phase 9**: Enterprise integration (workflow systems, performance tracking)

## Key Technical Decisions

### **Validated Architectural Choices**
- **Event-Driven Core**: Enables scalability and integration with existing systems
- **Factory Pattern**: Government email formats benefit from specialized parsing (confirmed by SEWP analysis)
- **Strategy Pattern**: Multi-factor compliance requirements require flexible matching algorithms
- **LLM Integration**: Amazon Bedrock Claude for intelligent content extraction

### **Strategic Trade-offs**
- **Email vs. Multi-Document Processing**: Focus on email parsing (5% of value) for MVP, acknowledge complete document ecosystem complexity (95% of value)
- **Generic vs. Specialized**: Implement basic patterns while respecting existing specialized systems
- **Time-Boxed Scope**: Demonstrate architectural thinking and complete domain understanding within assessment constraints

## Business Value

### **Problem Solved**
- **Manual Processing**: Automate extraction of bid requirements from complex government emails
- **Supplier Discovery**: Intelligent matching based on capabilities, compliance, and geographic factors
- **Time Efficiency**: Reduce bid preparation time through automated supplier suggestions

### **Government Contracting Fit**
- **Compliance-Aware**: Understands TAA, EPEAT, security requirements, business certifications
- **Format-Specific**: Handles SEWP, NASA, GSA procurement system variations
- **Integration-Ready**: API-driven design for existing UI and workflow system integration

## Assessment Context

This project demonstrates senior-level engineering capabilities through:
- **Enterprise Architecture**: Event-driven AWS serverless design patterns
- **Domain Understanding**: Government contracting complexity and existing system landscape
- **Technical Judgment**: Appropriate trade-offs with clear rationale and documentation
- **Modern Practices**: Infrastructure as Code, TypeScript, modern deployment strategies

Built as a technical assessment showcasing both technical depth and practical delivery judgment for a government contracting technology company role.