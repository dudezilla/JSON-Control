import { JSDOM } from 'jsdom';
import { ControlRegistry } from '@workspace/json-control';
import { ControlMetrics } from './ControlMetrics';

export interface DudezillaGlobal {
  bindings: ControlRegistry;
}

declare global {
  var dudezilla: DudezillaGlobal;
}

export class ControlHarness {
  private dom: JSDOM;
  public metrics: ControlMetrics;
  private _savedDocument: unknown;
  private _savedWindow: unknown;
  private _savedDudezilla: unknown;

  constructor(bodyHtml = '<div id="root"></div>') {
    this.dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`);
    this.metrics = new ControlMetrics();

    const g = global as unknown as Record<string, unknown>;
    this._savedDocument = Object.prototype.hasOwnProperty.call(g, 'document') ? g['document'] : undefined;
    this._savedWindow = Object.prototype.hasOwnProperty.call(g, 'window') ? g['window'] : undefined;
    this._savedDudezilla = Object.prototype.hasOwnProperty.call(g, 'dudezilla') ? g['dudezilla'] : undefined;

    this._applyGlobals();
  }

  private _applyGlobals(): void {
    const g = global as unknown as Record<string, unknown>;
    g['document'] = this.dom.window.document;
    g['window'] = this.dom.window;
    g['dudezilla'] = { bindings: new ControlRegistry() };
  }

  get document(): Document {
    return this.dom.window.document;
  }

  get window(): Window & typeof globalThis {
    return this.dom.window as unknown as Window & typeof globalThis;
  }

  get bindings(): ControlRegistry {
    return global.dudezilla.bindings;
  }

  resetBindings(): void {
    global.dudezilla = { bindings: new ControlRegistry() };
    this.metrics.clear();
  }

  teardown(): void {
    const g = global as unknown as Record<string, unknown>;
    if (this._savedDocument !== undefined) {
      g['document'] = this._savedDocument;
    } else {
      delete g['document'];
    }
    if (this._savedWindow !== undefined) {
      g['window'] = this._savedWindow;
    } else {
      delete g['window'];
    }
    if (this._savedDudezilla !== undefined) {
      g['dudezilla'] = this._savedDudezilla;
    } else {
      delete g['dudezilla'];
    }
  }
}

export function withHarness(
  fn: (harness: ControlHarness) => void,
  bodyHtml?: string,
): void {
  const harness = new ControlHarness(bodyHtml);
  try {
    fn(harness);
  } finally {
    harness.teardown();
  }
}
