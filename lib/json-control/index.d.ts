export interface ControlConfig {
  name: string;
  label: string;
  current: unknown;
  control_type: string;
  values?: unknown[];
  setName?: string;
  set_name?: string;
}

export interface HandlerSerialization {
  id: string;
  type: string;
  func: () => void;
}

export declare class Control {
  config: ControlConfig;
  rootID: string;
  parent: Control | undefined;
  htmlBuffer: string[];
  subControls: ControlRegistry;
  handlers: HandlerSerialization[];
  element: Element | undefined;

  constructor(controlConfig: ControlConfiguration);

  getElement(): Element | undefined;
  buildSubControls(): Element;
  applyHandlers(): void;
  applySubControlHandlers(): void;
  appendHandler(handler: HandlerSerialization): void;
  appendChild(control: Control): void;
  appendHTML(value: string): void;
  getHTML(): string;
  getParent(): Control;
  isChild(): boolean;
  getConfig(): ControlConfig;
  getName(): string;
  getLabel(): string;
  getID(): string;
  setValue(value: unknown): void;
  getValue(): unknown;
  eventLinkage(stateChange: unknown): void;
  onChildEvent(stateChange: unknown): void;
  getRoot(): Control;
  toString(): string;
  getJSON(): string;
}

export declare class ControlRegistry {
  append(control: Control): void;
  fetch(key: string): Control;
  fetchGlobal(key: string): Control;
  getKeys(): string[];
  includes(key: string): boolean;
  toJSON(): Record<string, ControlConfig>;
  isGlobal(): boolean;
}

export declare class ControlConfiguration {
  config: ControlConfig;
  rootID: string | undefined;
  parent: Control | undefined;

  constructor(config: ControlConfig);
  isValid(): boolean;
  getRootID(): string | undefined;
  setRootID(id: string): void;
  setParent(parent: Control | undefined): void;
  getParent(): Control | undefined;
  getConfig(): ControlConfig;
}

export declare class SelectionControl extends Control {
  selection: unknown[];
  constructor(controlConfiguration: ControlConfiguration);
  onChildEvent(stateChange: unknown): void;
  selectValue(index: number): unknown;
  getSelection(): unknown[];
}

export declare class ObservedSelectionControl extends SelectionControl {}

export declare class CodeSnippetControl extends Control {
  constructor(controlConfiguration: ControlConfiguration);
  escapeHTML(str: string): string;
  makeElement(): Element;
  updateView(): void;
}

export declare class CollapsibleCodeControl extends Control {
  constructor(controlConfiguration: ControlConfiguration);
  isExpanded(): boolean;
  setCode(code: string): void;
  onChildEvent(stateChange: unknown): void;
}

export declare function find(el: Element, id: string): Element;

export declare class ControlFactory {
  configs: ControlConfig[];
  rootID: string;
  bindings: ControlRegistry;
  controls: Control[];

  constructor(configs: ControlConfig[], rootID: string);

  /** Instantiate all controls, register them in bindings, set window.dudezilla. */
  build(): this;

  /** Append each control's DOM to rootEl and attach handlers. */
  mount(rootEl: Element): this;

  getBindings(): ControlRegistry;
  getControls(): Control[];
  getControl(name: string): Control | undefined;

  static getTypeMap(): Record<string, new (cfg: ControlConfiguration) => Control>;
}
