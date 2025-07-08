# Development Notes

This document contains thoughts and observations from the development process, highlighting areas for improvement and architectural decisions made during the project.

## 1. Environment Configuration & Local Development

### Current State
- No dev or prod mode configuration
- No way to start the application locally
- All testing requires deploying the full stack to AWS

### Improvements Needed
To make this project practical for ongoing development, we would need to implement:

- **Environment Configuration**: Proper dev and prod modes with environment-specific settings
- **Local Development Setup**: A way to run and test the application locally without deploying to AWS
- **Development Workflow**: Faster iteration cycles for development and debugging

### Impact
The current setup significantly slows down development velocity as every change requires a full deployment cycle to test.

## 2. Language Consistency

### Current State
- **Infrastructure**: Written in TypeScript (AWS CDK)
- **Lambda Functions**: Written in JavaScript

### Decision Context
This mixed approach was chosen due to time constraints during initial development.


### Improvements Needed
In a real-world scenario, I would also use typescript for the lambda's.  

- **Evaluate TypeScript for Lambdas**: Migrate Lambda functions to TypeScript for better type safety and consistency
- **Bundling Strategy**: Implement proper bundling and transpilation for TypeScript Lambda functions
- **Development Tools**: Set up appropriate tooling for a unified TypeScript development experience

### Trade-offs
- **Current**: Faster initial development due to JavaScript's simplicity
- **Future**: Better maintainability and type safety with full TypeScript adoption

## Future Considerations

These notes serve as a foundation for future architectural decisions and development process improvements. Priority should be given to local development capabilities to improve developer experience and productivity. 