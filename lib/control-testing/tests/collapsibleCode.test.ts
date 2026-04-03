import { useControlHarness } from '../src/harnessHooks';
import { SpyControl, makeSpyConfig } from '../src/SpyControl';
import { EventSimulator } from '../src/EventSimulator';
import { CollapsibleCodeControl, ControlConfiguration } from '@workspace/json-control';

const getHarness = useControlHarness();

function makeCollapsibleConfig(name: string, code: string, label = 'Show code'): ControlConfiguration {
  const config = new ControlConfiguration({
    name,
    label,
    state: code,
    control_type: 'collapsible_code',
  });
  config.setRootID('root');
  return config;
}

describe('CollapsibleCodeControl structure', () => {
  test('getElement returns a <div> with the control ID', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('c0', 'const x = 1;'));
    const el = ctrl.getElement() as Element;
    expect(el.tagName.toLowerCase()).toBe('div');
    expect(el.id).toBe('root__c0');
  });

  test('contains an <h3> heading with the label text', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('c1', 'let y = 2;', 'My Snippet'));
    const el = ctrl.getElement() as Element;
    const heading = el.querySelector('h3');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe('My Snippet');
  });

  test('contains a <pre><code> block with the code content', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('c2', 'console.log("hi");'));
    const el = ctrl.getElement() as Element;
    expect(el.querySelector('pre code')).not.toBeNull();
    expect(el.querySelector('pre code')?.textContent).toBe('console.log("hi");');
  });

  test('code block is visible by default', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('c3', 'const z = 3;'));
    expect(ctrl.isExpanded()).toBe(true);
    const snippetEl = (ctrl.getElement() as Element).querySelector('figure') as HTMLElement;
    expect(snippetEl.style.display).not.toBe('none');
  });

  test('heading has aria-expanded="true" by default', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('c4', 'x = 1;'));
    const heading = (ctrl.getElement() as Element).querySelector('h3');
    expect(heading?.getAttribute('aria-expanded')).toBe('true');
  });

  test('snippet is registered as a child in subControls', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('c5', 'fn();'));
    const keys = ctrl.subControls.getKeys();
    expect(keys).toContain('root__c5__snippet');
  });
});

describe('CollapsibleCodeControl toggle behaviour', () => {
  test('clicking the heading hides the code block', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('t0', 'const a = 1;'));
    const el = ctrl.getElement() as Element;
    const heading = el.querySelector('h3') as Element;

    EventSimulator.dispatchClick(heading);

    expect(ctrl.isExpanded()).toBe(false);
    const snippetEl = el.querySelector('figure') as HTMLElement;
    expect(snippetEl.style.display).toBe('none');
  });

  test('clicking the heading again re-shows the code block', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('t1', 'const b = 2;'));
    const el = ctrl.getElement() as Element;
    const heading = el.querySelector('h3') as Element;

    EventSimulator.dispatchClick(heading);
    EventSimulator.dispatchClick(heading);

    expect(ctrl.isExpanded()).toBe(true);
    const snippetEl = el.querySelector('figure') as HTMLElement;
    expect(snippetEl.style.display).not.toBe('none');
  });

  test('aria-expanded toggles correctly on each click', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('t2', 'x;'));
    const el = ctrl.getElement() as Element;
    const heading = el.querySelector('h3') as Element;

    EventSimulator.dispatchClick(heading);
    expect(heading.getAttribute('aria-expanded')).toBe('false');

    EventSimulator.dispatchClick(heading);
    expect(heading.getAttribute('aria-expanded')).toBe('true');
  });

  test('click propagates to parent onChildEvent via eventLinkage', () => {
    const harness = getHarness();
    const received: unknown[] = [];
    const parent = new SpyControl(makeSpyConfig('parent', 'root'), harness.metrics);
    (parent as any).onChildEvent = (state: unknown) => received.push(state);

    const childConfig = new ControlConfiguration({
      name: 'collapsible',
      label: 'Toggle',
      state: 'code here',
      control_type: 'collapsible_code',
    });
    childConfig.setParent(parent);
    const ctrl = new CollapsibleCodeControl(childConfig);

    const heading = (ctrl.getElement() as Element).querySelector('h3') as Element;
    EventSimulator.dispatchClick(heading);

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect((received[0] as any).visible).toBe(false);
  });
});

describe('CollapsibleCodeControl setCode', () => {
  test('setCode updates the code block content', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('u0', 'old code'));
    ctrl.setCode('new code');
    const code = (ctrl.getElement() as Element).querySelector('code');
    expect(code?.textContent).toBe('new code');
  });

  test('setCode escapes HTML in the new snippet', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('u1', 'old'));
    ctrl.setCode('<div>injection</div>');
    const code = (ctrl.getElement() as Element).querySelector('code');
    expect(code?.innerHTML).toContain('&lt;div&gt;');
    expect(code?.innerHTML).not.toContain('<div>');
  });

  test('getValue reflects the new code after setCode', () => {
    getHarness();
    const ctrl = new CollapsibleCodeControl(makeCollapsibleConfig('u2', 'original'));
    ctrl.setCode('updated');
    expect(ctrl.getValue()).toBe('updated');
  });
});
