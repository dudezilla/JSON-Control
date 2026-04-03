import { Control, ControlConfiguration } from '@workspace/json-control';
import { ControlMetrics } from './ControlMetrics';

export class SpyControl extends Control {
  private _metrics: ControlMetrics;

  constructor(config: ControlConfiguration, metrics: ControlMetrics) {
    super(config);
    this._metrics = metrics;

    const el = document.createElement('div');
    el.id = this.getID();
    this.element = el;

    this._metrics.record({
      id: this.getID(),
      event: 'construct',
      timestamp: Date.now(),
      payload: {
        name: this.getName(),
        label: this.getLabel(),
        value: this.getValue() as unknown,
        control_type: this.getConfig().control_type,
      },
    });
  }

  override getElement(): Element {
    this._metrics.record({
      id: this.getID(),
      event: 'getElement',
      timestamp: Date.now(),
    });
    return super.getElement() as Element;
  }

  override setValue(value: unknown): void {
    const oldValue = this.getValue();
    super.setValue(value);
    this._metrics.record({
      id: this.getID(),
      event: 'setValue',
      timestamp: Date.now(),
      payload: { oldValue, newValue: value },
    });
  }

  override applyHandlers(): void {
    this._metrics.record({
      id: this.getID(),
      event: 'applyHandlers',
      timestamp: Date.now(),
    });
    super.applyHandlers();
  }

  override eventLinkage(stateChange: unknown): void {
    this._metrics.record({
      id: this.getID(),
      event: 'eventLinkage',
      timestamp: Date.now(),
      payload: { stateChange },
    });
    super.eventLinkage(stateChange);
  }

  override onChildEvent(stateChange: unknown): void {
    this._metrics.record({
      id: this.getID(),
      event: 'onChildEvent',
      timestamp: Date.now(),
      payload: { stateChange },
    });
  }
}

export function makeSpyConfig(
  name: string,
  rootIdOrParent: string | Control,
  currentValue: unknown = '0',
  label?: string,
): ControlConfiguration {
  const config = new ControlConfiguration({
    name,
    label: label ?? `Label_${name}`,
    state: currentValue,
    control_type: 'spy_control',
  });
  if (typeof rootIdOrParent === 'string') {
    config.setRootID(rootIdOrParent);
  } else {
    config.setParent(rootIdOrParent);
  }
  return config;
}
