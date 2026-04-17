import { TelemetryEvent, SimulationError, SimulationStep } from '../model/types';

export interface TelemetryConfig {
  apiEndpoint: string;
  sessionId: string;
  studentId: string;
  batchSize: number;
  flushInterval: number; // in milliseconds
  retryAttempts: number;
}

export class TelemetryManager {
  private config: TelemetryConfig;
  private eventQueue: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;

  constructor(config: TelemetryConfig) {
    this.config = config;
    this.startFlushTimer();
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueue(); // Attempt to flush when back online
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createEvent(
    eventType: TelemetryEvent['eventType'],
    step?: SimulationStep,
    data?: any,
    duration?: number
  ): TelemetryEvent {
    return {
      id: this.generateEventId(),
      sessionId: this.config.sessionId,
      studentId: this.config.studentId,
      timestamp: new Date(),
      eventType,
      step,
      data: data || {},
      duration
    };
  }

  public logStepStart(step: SimulationStep, data?: any): void {
    const event = this.createEvent('step_start', step, data);
    this.addToQueue(event);
  }

  public logStepComplete(step: SimulationStep, duration: number, data?: any): void {
    const event = this.createEvent('step_complete', step, data, duration);
    this.addToQueue(event);
  }

  public logError(error: SimulationError): void {
    const event = this.createEvent('error', error.step, {
      errorId: error.id,
      type: error.type,
      message: error.message,
      severity: error.severity,
      data: error.data
    });
    this.addToQueue(event);

    // Immediately flush critical errors
    if (error.severity === 'critical') {
      this.flushQueue();
    }
  }

  public logAction(action: string, step?: SimulationStep, data?: any): void {
    const event = this.createEvent('action', step, {
      action,
      ...data
    });
    this.addToQueue(event);
  }

  public logTemperatureChange(
    propertyId: string,
    oldTemperature: number,
    newTemperature: number,
    step?: SimulationStep
  ): void {
    const event = this.createEvent('temperature_change', step, {
      propertyId,
      oldTemperature,
      newTemperature,
      difference: newTemperature - oldTemperature
    });
    this.addToQueue(event);
  }

  private addToQueue(event: TelemetryEvent): void {
    this.eventQueue.push(event);

    // Auto-flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushQueue();
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flushQueue();
      }
    }, this.config.flushInterval);
  }

  private async flushQueue(): Promise<void> {
    if (!this.isOnline || this.eventQueue.length === 0) {
      return;
    }

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = []; // Clear queue immediately

    try {
      await this.sendEvents(eventsToSend);
    } catch (error) {
      console.error('Failed to send telemetry events:', error);
      // Re-add failed events to queue for retry
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  private async sendEvents(events: TelemetryEvent[]): Promise<void> {
    const payload = {
      sessionId: this.config.sessionId,
      studentId: this.config.studentId,
      events,
      clientTimestamp: new Date().toISOString()
    };

    let attempt = 0;
    while (attempt < this.config.retryAttempts) {
      try {
        const response = await fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': this.config.sessionId,
            'X-Student-ID': this.config.studentId
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Successfully sent
        return;
      } catch (error) {
        attempt++;
        if (attempt >= this.config.retryAttempts) {
          throw error;
        }
        
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getQueueSize(): number {
    return this.eventQueue.length;
  }

  public getPendingEvents(): TelemetryEvent[] {
    return [...this.eventQueue];
  }

  public forceFlush(): Promise<void> {
    return this.flushQueue();
  }

  public updateConfig(newConfig: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush before destroy
    if (this.eventQueue.length > 0) {
      this.flushQueue();
    }
  }
}
