import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface ApiConstructProps {
  readonly apiLambda: lambda.Function;
}

/**
 * API Construct - Manages API Gateway and endpoints
 */
export class ApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    // API Gateway for frontend integration
    this.api = new apigateway.RestApi(this, 'EmailParsingAPI', {
      restApiName: 'Email Parsing API',
      description: 'API for email parsing and supplier suggestions',
      deployOptions: {
        stageName: 'dev',
        description: 'Development stage for email parsing API',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'], // TODO: Restrict to Vercel domain in production
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // API Gateway endpoints
    const integration = new apigateway.LambdaIntegration(props.apiLambda);
    
    const suppliersResource = this.api.root.addResource('suppliers');
    suppliersResource.addResource('suggest').addMethod('POST', integration);
    
    const emailsResource = this.api.root.addResource('emails');
    emailsResource.addResource('{id}').addResource('matches').addMethod('GET', integration);
    
    suppliersResource.addResource('feedback').addMethod('POST', integration);
  }
} 