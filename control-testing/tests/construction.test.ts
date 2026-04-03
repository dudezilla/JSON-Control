import { useControlHarness } from '../src/harnessHooks';
import { SpyControl, makeSpyConfig } from '../src/SpyControl';

const getHarness = useControlHarness();

describe('SpyControl construction metrics', () => {
  test('records a construct event when a single SpyControl is created', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('a0', 'root'), harness.metrics);

    const events = harness.metrics.getEventsFor(control.getID());
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('construct');
    expect(events[0].timestamp).toBeGreaterThan(0);
    expect(events[0].id).toBe('root__a0');
  });

  test('construct payload includes name, label, value, and control_type', () => {
    const harness = getHarness();
    new SpyControl(makeSpyConfig('b0', 'root', 'hello', 'My Label'), harness.metrics);

    const events = harness.metrics.getEventsFor('root__b0');
    expect(events[0].payload).toMatchObject({
      name: 'b0',
      label: 'My Label',
      value: 'hello',
      control_type: 'spy_control',
    });
  });

  test('countEventType returns correct construct count for a single control', () => {
    const harness = getHarness();
    new SpyControl(makeSpyConfig('c0', 'root'), harness.metrics);
    expect(harness.metrics.countEventType('construct')).toBe(1);
  });

  test('records a construct event for each control in a two-level hierarchy', () => {
    const harness = getHarness();
    const parent = new SpyControl(makeSpyConfig('parent', 'root'), harness.metrics);
    new SpyControl(makeSpyConfig('child', parent), harness.metrics);

    expect(harness.metrics.countEventType('construct')).toBe(2);
    expect(harness.metrics.getEventsFor('root__parent')).toHaveLength(1);
    expect(harness.metrics.getEventsFor('root__parent__child')).toHaveLength(1);
  });

  test('records construct events for a three-level hierarchy', () => {
    const harness = getHarness();
    const grandparent = new SpyControl(makeSpyConfig('gp', 'root'), harness.metrics);
    const parent = new SpyControl(makeSpyConfig('p', grandparent), harness.metrics);
    new SpyControl(makeSpyConfig('c', parent), harness.metrics);

    expect(harness.metrics.countEventType('construct')).toBe(3);
  });

  test('getTimeline returns events sorted by timestamp', () => {
    const harness = getHarness();
    new SpyControl(makeSpyConfig('x1', 'root'), harness.metrics);
    new SpyControl(makeSpyConfig('x2', 'root'), harness.metrics);
    new SpyControl(makeSpyConfig('x3', 'root'), harness.metrics);

    const timeline = harness.metrics.getTimeline();
    expect(timeline).toHaveLength(3);
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].timestamp).toBeGreaterThanOrEqual(timeline[i - 1].timestamp);
    }
  });
});
