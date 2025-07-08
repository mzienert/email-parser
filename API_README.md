# Email Parser System - API Documentation

## Overview

The Email Parser System is an AI-powered serverless application that processes government procurement emails and provides intelligent supplier recommendations. Built on AWS with event-driven architecture, it uses Amazon Bedrock (Claude models) for intelligent content extraction and multi-strategy supplier matching.

## Base URL

```
https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/
```

## Authentication

Currently, the API endpoints are publicly accessible for development purposes. In production, authentication should be implemented via API Gateway authorizers.

## API Endpoints

### 1. POST /suppliers/suggest

**Purpose**: Get real-time supplier suggestions based on item requirements and preferences.

**Endpoint**: `POST /suppliers/suggest`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "items": [
    {
      "name": "string (required)",
      "category": "string (optional)",
      "brand": "string (optional)"
    }
  ],
  "requirements": {
    "taaCompliant": "boolean (optional)",
    "businessCertifications": ["array of strings (optional)"],
    "securityClearance": "string (optional)"
  },
  "preferences": {
    "state": "string (optional)",
    "region": "string (optional)",
    "businessSize": "string (optional)"
  }
}
```

**Example Request**:
```bash
curl -X POST "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/suppliers/suggest" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "name": "Nutanix software",
        "category": "software"
      }
    ],
    "requirements": {
      "taaCompliant": true,
      "businessCertifications": ["HUBZone", "SDVOSB"]
    },
    "preferences": {
      "state": "WV"
    }
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Supplier suggestions generated successfully",
  "data": {
    "suggestions": [
      {
        "supplierId": "SUPP-001-NUTANIX-RESELLER",
        "companyName": "Federal Tech Solutions LLC",
        "score": 0.85,
        "confidence": "high",
        "capabilities": ["software", "maintenance"],
        "complianceStatus": {
          "taaCompliant": true
        },
        "businessCertifications": ["HUBZone", "SDVOSB"],
        "contactInfo": {
          "email": "contact@federaltech.com",
          "phone": "+1-304-555-0123"
        },
        "matchReasons": [
          "TAA compliant",
          "HUBZone certified",
          "West Virginia location preference"
        ]
      }
    ],
    "totalEvaluated": 3,
    "metadata": {
      "generatedAt": "2024-01-15T10:30:00Z",
      "threshold": 0.1,
      "duration": "150ms"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Business Certification Options**:
- `HUBZone` - Historically Underutilized Business Zone
- `SDVOSB` - Service-Disabled Veteran-Owned Small Business
- `8(a)` - Small Disadvantaged Business
- `WOSB` - Women-Owned Small Business
- `VOSB` - Veteran-Owned Small Business

---

### 2. GET /emails/{id}/matches

**Purpose**: Retrieve supplier match results for a previously processed email.

**Endpoint**: `GET /emails/{id}/matches`

**Path Parameters**:
- `id` (string, required): Email identifier (e.g., "sewp-nutanix-rfq")

**Example Request**:
```bash
curl -X GET "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/emails/sewp-nutanix-rfq/matches"
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Email matches retrieved successfully",
  "data": {
    "email": {
      "emailId": "sewp-nutanix-rfq"
    },
    "matches": [
      {
        "supplierId": "SUPP-001-NUTANIX-RESELLER",
        "companyName": "Federal Tech Solutions LLC",
        "compositeScore": 0.639,
        "confidence": "medium",
        "strategyScores": {
          "compliance": 0.85,
          "fuzzyMatch": 0.72,
          "geographic": 0.90
        },
        "capabilities": ["software", "maintenance"],
        "businessCertifications": ["HUBZone", "SDVOSB"],
        "contactInfo": {
          "email": "contact@federaltech.com",
          "phone": "+1-304-555-0123"
        }
      }
    ],
    "matchCount": 3,
    "matchSummary": {
      "averageScore": 0.610,
      "topScore": 0.639,
      "strategySummary": {
        "complianceWeight": 0.4,
        "fuzzyMatchWeight": 0.35,
        "geographicWeight": 0.25
      },
      "processingTime": "2024-01-15T10:25:00Z"
    },
    "metadata": {
      "retrievedAt": "2024-01-15T10:30:00Z",
      "duration": "85ms"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response** (404 Not Found):
```json
{
  "success": false,
  "message": "No matches found for this email",
  "data": {
    "email": {
      "emailId": "nonexistent-email"
    },
    "matches": [],
    "matchCount": 0
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### 3. POST /suppliers/feedback

**Purpose**: Submit feedback on supplier match quality to improve future recommendations.

**Endpoint**: `POST /suppliers/feedback`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "emailId": "string (required)",
  "supplierId": "string (required)",
  "feedback": "string (required)",
  "rating": "number (required, 1-5)",
  "comments": "string (optional)"
}
```

**Feedback Values**:
- `"good_match"` - Supplier was a good match for requirements
- `"poor_match"` - Supplier was not a good match
- `"acceptable"` - Supplier was acceptable but not ideal

**Rating Scale**: 1-5 (1 = Poor, 5 = Excellent)

**Example Request**:
```bash
curl -X POST "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/suppliers/feedback" \
  -H "Content-Type: application/json" \
  -d '{
    "emailId": "sewp-nutanix-rfq",
    "supplierId": "SUPP-001-NUTANIX-RESELLER",
    "feedback": "good_match",
    "rating": 4,
    "comments": "Great supplier match for our Nutanix requirements. Fast response time and competitive pricing."
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Feedback submitted successfully",
  "data": {
    "feedbackId": "feedback-001-2024-01-15",
    "emailId": "sewp-nutanix-rfq",
    "supplierId": "SUPP-001-NUTANIX-RESELLER",
    "feedback": "good_match",
    "rating": 4,
    "submittedAt": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Handling

All endpoints return standardized error responses with the following structure:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "error": {
    "name": "ErrorType",
    "message": "Detailed technical error message"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common HTTP Status Codes

| Status Code | Description | Common Causes |
|------------|-------------|---------------|
| 200 | Success | Request processed successfully |
| 400 | Bad Request | Missing required fields, invalid JSON, validation errors |
| 404 | Not Found | Invalid email ID, resource doesn't exist |
| 405 | Method Not Allowed | Wrong HTTP method for endpoint |
| 500 | Internal Server Error | Server-side processing error |

### Example Error Responses

**400 Bad Request** (Missing required field):
```json
{
  "success": false,
  "message": "Items array is required and must not be empty",
  "error": null,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**404 Not Found** (Invalid email ID):
```json
{
  "success": false,
  "message": "Email ID is required",
  "error": null,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## System Architecture

### Key Features

- **Event-Driven Architecture**: S3 → EventBridge → SQS → Lambda processing flow
- **Serverless**: AWS Lambda functions with automatic scaling
- **AI-Powered**: Amazon Bedrock integration with Claude models for intelligent parsing
- **Multi-Strategy Matching**: Combines compliance, fuzzy matching, and geographic algorithms
- **Government Compliance**: Built-in support for TAA compliance and business certifications

### Performance Metrics

| Operation | Average Response Time | Description |
|-----------|---------------------|-------------|
| Supplier Suggestions | 80-250ms | Real-time supplier recommendations |
| Email Match Retrieval | 85ms | Fetch existing match results |
| Feedback Submission | 50-100ms | Store user feedback |
| Email Processing | 6-8s | End-to-end email → supplier matches |

### Supported Procurement Formats

- **SEWP (Solutions for Enterprise-Wide Procurement)**: V, VI versions
- **NASA**: Network and IT procurement formats
- **GSA**: General Services Administration RFIs
- **Generic**: Standard government procurement formats

## CORS Configuration

The API Gateway is configured with Cross-Origin Resource Sharing (CORS) support:

- **Allow Origins**: `*` (configured for frontend integration)
- **Allow Methods**: `GET, POST, PUT, DELETE, OPTIONS`
- **Allow Headers**: `Content-Type, Authorization`

## Rate Limiting

Currently, no rate limiting is implemented. In production, consider implementing:
- API Gateway throttling
- Usage plans with API keys
- Per-client rate limits

## Testing

### Sample Data

The system includes test emails for validation:
- `sewp-nutanix-rfq` - SEWP V Nutanix software procurement
- `nasa-networking-rfq` - NASA networking equipment request
- `gsa-generic-rfi` - Generic GSA information request

### Testing Commands

Test all endpoints with sample data:

```bash
# Test supplier suggestions
curl -X POST "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/suppliers/suggest" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Nutanix software"}],"requirements":{"taaCompliant":true}}'

# Test email matches
curl -X GET "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/emails/sewp-nutanix-rfq/matches"

# Test feedback submission
curl -X POST "https://ms3d3yxove.execute-api.us-west-2.amazonaws.com/dev/suppliers/feedback" \
  -H "Content-Type: application/json" \
  -d '{"emailId":"sewp-nutanix-rfq","supplierId":"SUPP-001","feedback":"good_match","rating":4}'
```

## Production Considerations

### Security Recommendations

1. **Authentication**: Implement API Gateway authorizers (Lambda, Cognito, or IAM)
2. **CORS**: Restrict allowed origins to specific domains
3. **Rate Limiting**: Implement throttling and usage plans
4. **WAF**: Add Web Application Firewall for protection
5. **Encryption**: Enable API Gateway logging with encryption

### Monitoring

Set up monitoring for:
- API Gateway request/response metrics
- Lambda function duration and errors
- DynamoDB read/write capacity
- Custom business metrics (match quality, user satisfaction)

### Scaling Considerations

- Lambda concurrent execution limits
- DynamoDB provisioned capacity or on-demand scaling
- API Gateway throttling thresholds
- EventBridge rule processing limits

## Support

For technical issues or feature requests:
1. Check CloudWatch logs for error details
2. Monitor DynamoDB for data consistency
3. Verify IAM permissions for cross-service access
4. Review EventBridge rules for proper event routing

## Changelog

- **v1.0** (Current): Initial API release with core supplier matching functionality
  - POST /suppliers/suggest
  - GET /emails/{id}/matches  
  - POST /suppliers/feedback
  - Multi-strategy supplier scoring
  - Government compliance filtering 