export class EventSimulator {
  static dispatchClick(element: Element): boolean {
    const doc = element.ownerDocument;
    if (!doc || !doc.defaultView) {
      throw new Error('EventSimulator: element has no ownerDocument.defaultView');
    }
    const EventCtor = (doc.defaultView as unknown as Record<string, typeof Event>)['Event'];
    const event = new EventCtor('click', { bubbles: true, cancelable: true });
    return element.dispatchEvent(event);
  }

  static dispatchChange(element: Element, value?: string): boolean {
    const doc = element.ownerDocument;
    if (!doc || !doc.defaultView) {
      throw new Error('EventSimulator: element has no ownerDocument.defaultView');
    }
    if (value !== undefined) {
      (element as HTMLInputElement).value = value;
    }
    const EventCtor = (doc.defaultView as unknown as Record<string, typeof Event>)['Event'];
    const event = new EventCtor('change', { bubbles: true, cancelable: true });
    return element.dispatchEvent(event);
  }

  static dispatchCustom(element: Element, eventName: string, detail?: unknown): boolean {
    const doc = element.ownerDocument;
    if (!doc || !doc.defaultView) {
      throw new Error('EventSimulator: element has no ownerDocument.defaultView');
    }
    const CustomEventCtor = (doc.defaultView as unknown as Record<string, typeof CustomEvent>)[
      'CustomEvent'
    ];
    const event = new CustomEventCtor(eventName, {
      bubbles: true,
      cancelable: true,
      detail,
    });
    return element.dispatchEvent(event);
  }
}
