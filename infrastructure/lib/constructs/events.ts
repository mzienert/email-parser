import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';

/**
 * Events Construct - Manages EventBridge custom event bus
 */
export class EventsConstruct extends Construct {
  public readonly emailEventBus: events.EventBus;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // EventBridge custom event bus
    this.emailEventBus = new events.EventBus(this, 'EmailEventBus', {
      eventBusName: 'email-parsing-events',
      description: 'Event bus for email processing workflow',
    });
  }
} 