import { useControlHarness } from '../src/harnessHooks';
import { SpyControl, makeSpyConfig } from '../src/SpyControl';
import { CodeSnippetControl, ControlConfiguration } from '@workspace/json-control';

const getHarness = useControlHarness();

function makeSnippetConfig(name: string, code: string, label = 'Code:'): ControlConfiguration {
  const config = new ControlConfiguration({
    name,
    label,
    state: code,
    control_type: 'code_snippet',
  });
  config.setRootID('root');
  return config;
}

describe('CodeSnippetControl rendering', () => {
  test('getElement returns a <figure> with the control ID', () => {
    getHarness();
    const ctrl = new CodeSnippetControl(makeSnippetConfig('s0', 'const x = 1;'));
    const el = ctrl.getElement() as Element;
    expect(el.tagName.toLowerCase()).toBe('figure');
    expect(el.id).toBe('root__s0');
  });

  test('renders a <pre><code> block inside the figure', () => {
    getHarness();
    const ctrl = new CodeSnippetControl(makeSnippetConfig('s1', 'let y = 2;'));
    const el = ctrl.getElement() as Element;
    expect(el.querySelector('pre')).not.toBeNull();
    expect(el.querySelector('pre code')).not.toBeNull();
  });

  test('code content is set from the current value', () => {
    getHarness();
    const ctrl = new CodeSnippetControl(makeSnippetConfig('s2', 'console.log("hello");'));
    const code = (ctrl.getElement() as Element).querySelector('code');
    expect(code?.textContent).toBe('console.log("hello");');
  });

  test('HTML special characters are escaped in the code block', () => {
    getHarness();
    const ctrl = new CodeSnippetControl(makeSnippetConfig('s3', 'const x = 1 < 2 && 3 > 0;'));
    const code = (ctrl.getElement() as Element).querySelector('code');
    expect(code?.innerHTML).toContain('&lt;');
    expect(code?.innerHTML).toContain('&gt;');
    expect(code?.innerHTML).toContain('&amp;');
  });

  test('renders a <figcaption> with the label', () => {
    getHarness();
    const ctrl = new CodeSnippetControl(makeSnippetConfig('s4', 'x = 1', 'My Label:'));
    const caption = (ctrl.getElement() as Element).querySelector('figcaption');
    expect(caption?.textContent).toBe('My Label:');
  });

  test('updateView pushes a new value to the <code> block', () => {
    getHarness();
    const ctrl = new CodeSnippetControl(makeSnippetConfig('s5', 'const a = 1;'));
    ctrl.setValue('const b = 2;');
    ctrl.updateView();
    const code = (ctrl.getElement() as Element).querySelector('code');
    expect(code?.innerHTML).toBe('const b = 2;');
  });

  test('updateView escapes HTML in the new value', () => {
    getHarness();
    const ctrl = new CodeSnippetControl(makeSnippetConfig('s6', 'old'));
    ctrl.setValue('<script>alert("xss")</script>');
    ctrl.updateView();
    const code = (ctrl.getElement() as Element).querySelector('code');
    expect(code?.innerHTML).toContain('&lt;script&gt;');
    expect(code?.innerHTML).not.toContain('<script>');
  });

  test('SpyControl metrics still work alongside a CodeSnippetControl', () => {
    const harness = getHarness();
    const spy = new SpyControl(makeSpyConfig('spy', 'root'), harness.metrics);
    new CodeSnippetControl(makeSnippetConfig('s7', 'const z = 3;'));

    spy.setValue('updated');
    expect(harness.metrics.assertSequence('root__spy', ['construct', 'setValue'])).toBe(true);
    expect(harness.metrics.countEventType('construct')).toBe(1);
  });
});
