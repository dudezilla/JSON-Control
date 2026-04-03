import { useControlHarness } from '../src/harnessHooks';
import { SpyControl, makeSpyConfig } from '../src/SpyControl';

const getHarness = useControlHarness();

describe('SpyControl getElement metrics', () => {
  test('getElement returns a DOM Element', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('a0', 'root'), harness.metrics);
    const el = control.getElement();
    expect(el).toBeDefined();
    expect(el.id).toBe('root__a0');
  });

  test('getElement records a getElement event', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('a0', 'root'), harness.metrics);
    control.getElement();

    const events = harness.metrics.getEventsFor('root__a0');
    const getElEvents = events.filter((e) => e.event === 'getElement');
    expect(getElEvents).toHaveLength(1);
    expect(getElEvents[0].timestamp).toBeGreaterThan(0);
  });

  test('multiple getElement calls are each recorded', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('b0', 'root'), harness.metrics);
    control.getElement();
    control.getElement();
    control.getElement();

    const getElEvents = harness.metrics
      .getEventsFor('root__b0')
      .filter((e) => e.event === 'getElement');
    expect(getElEvents).toHaveLength(3);
  });

  test('assertSequence detects construct then getElement order', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('c0', 'root'), harness.metrics);
    control.getElement();

    const inOrder = harness.metrics.assertSequence('root__c0', ['construct', 'getElement']);
    expect(inOrder).toBe(true);
  });

  test('assertSequence fails if expected order is reversed', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('d0', 'root'), harness.metrics);
    control.getElement();

    const wrongOrder = harness.metrics.assertSequence('root__d0', ['getElement', 'construct']);
    expect(wrongOrder).toBe(false);
  });
});
