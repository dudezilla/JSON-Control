import { useControlHarness } from '../src/harnessHooks';
import { SpyControl, makeSpyConfig } from '../src/SpyControl';

const getHarness = useControlHarness();

describe('SpyControl setValue metrics', () => {
  test('setValue records a setValue event with old and new values', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('a0', 'root', 'initial'), harness.metrics);
    control.setValue('updated');

    const setValueEvents = harness.metrics
      .getEventsFor('root__a0')
      .filter((e) => e.event === 'setValue');

    expect(setValueEvents).toHaveLength(1);
    expect(setValueEvents[0].payload).toMatchObject({
      oldValue: 'initial',
      newValue: 'updated',
    });
  });

  test('getValue returns the new value after setValue', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('b0', 'root', false), harness.metrics);
    control.setValue(true);
    expect(control.getValue()).toBe(true);
  });

  test('multiple setValue calls are all recorded', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('c0', 'root', 0), harness.metrics);
    control.setValue(1);
    control.setValue(2);
    control.setValue(3);

    const setValueEvents = harness.metrics
      .getEventsFor('root__c0')
      .filter((e) => e.event === 'setValue');
    expect(setValueEvents).toHaveLength(3);

    expect(setValueEvents[0].payload).toMatchObject({ oldValue: 0, newValue: 1 });
    expect(setValueEvents[1].payload).toMatchObject({ oldValue: 1, newValue: 2 });
    expect(setValueEvents[2].payload).toMatchObject({ oldValue: 2, newValue: 3 });
  });

  test('assertSequence confirms construct then setValue order', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('d0', 'root'), harness.metrics);
    control.setValue('x');

    expect(harness.metrics.assertSequence('root__d0', ['construct', 'setValue'])).toBe(true);
  });

  test('construct then getElement then setValue sequence is detected', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('e0', 'root'), harness.metrics);
    control.getElement();
    control.setValue('after-display');

    expect(
      harness.metrics.assertSequence('root__e0', ['construct', 'getElement', 'setValue']),
    ).toBe(true);
  });
});
