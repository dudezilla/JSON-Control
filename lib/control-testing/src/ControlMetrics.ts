export type LifecycleEventType =
  | 'construct'
  | 'getElement'
  | 'setValue'
  | 'applyHandlers'
  | 'eventLinkage'
  | 'onChildEvent';

export interface LifecycleEvent {
  id: string;
  event: LifecycleEventType;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export class ControlMetrics {
  private events: LifecycleEvent[] = [];

  record(entry: LifecycleEvent): void {
    this.events.push(entry);
  }

  getEventsFor(id: string): LifecycleEvent[] {
    return this.events.filter((e) => e.id === id);
  }

  countEventType(type: LifecycleEventType): number {
    return this.events.filter((e) => e.event === type).length;
  }

  getTimeline(): LifecycleEvent[] {
    return [...this.events].sort((a, b) => a.timestamp - b.timestamp);
  }

  assertSequence(id: string, expectedTypes: LifecycleEventType[]): boolean {
    const events = this.getEventsFor(id);
    const actualTypes = events.map((e) => e.event);
    let eIdx = 0;
    for (let i = 0; i < actualTypes.length && eIdx < expectedTypes.length; i++) {
      if (actualTypes[i] === expectedTypes[eIdx]) {
        eIdx++;
      }
    }
    return eIdx === expectedTypes.length;
  }

  clear(): void {
    this.events = [];
  }

  all(): LifecycleEvent[] {
    return [...this.events];
  }
}
