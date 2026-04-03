import { useControlHarness } from '../src/harnessHooks';
import { SpyControl, makeSpyConfig } from '../src/SpyControl';
import { ControlRegistry } from '@workspace/json-control';

const getHarness = useControlHarness();

describe('ControlRegistry via ControlHarness', () => {
  test('appending a SpyControl and fetching it from global bindings', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('a0', 'root'), harness.metrics);
    harness.bindings.append(control);

    const fetched = harness.bindings.fetch('root__a0');
    expect(fetched).toBe(control);
  });

  test('fetch throws if key is not in local bindings', () => {
    const harness = getHarness();
    expect(() => harness.bindings.fetch('root__nonexistent')).toThrow();
  });

  test('fetchGlobal finds a child control across the hierarchy', () => {
    const harness = getHarness();
    const parent = new SpyControl(makeSpyConfig('p', 'root'), harness.metrics);
    harness.bindings.append(parent);

    const child = new SpyControl(makeSpyConfig('c', parent), harness.metrics);
    parent.appendChild(child);

    const fetched = harness.bindings.fetchGlobal('root__p__c');
    expect(fetched).toBe(child);
  });

  test('fetchGlobal throws if key does not exist anywhere', () => {
    const harness = getHarness();
    expect(() => harness.bindings.fetchGlobal('root__does__not__exist')).toThrow();
  });

  test('appendChild with a duplicate key throws', () => {
    const harness = getHarness();
    const parent = new SpyControl(makeSpyConfig('parent', 'root'), harness.metrics);
    harness.bindings.append(parent);

    const child1 = new SpyControl(makeSpyConfig('child', parent), harness.metrics);
    parent.appendChild(child1);

    const duplicateChild = new SpyControl(makeSpyConfig('child', parent), harness.metrics);
    expect(() => parent.appendChild(duplicateChild)).toThrow();
  });

  test('getKeys returns all appended control IDs in global bindings', () => {
    const harness = getHarness();
    const c1 = new SpyControl(makeSpyConfig('c1', 'root'), harness.metrics);
    const c2 = new SpyControl(makeSpyConfig('c2', 'root'), harness.metrics);
    const c3 = new SpyControl(makeSpyConfig('c3', 'root'), harness.metrics);

    harness.bindings.append(c1);
    harness.bindings.append(c2);
    harness.bindings.append(c3);

    const keys = harness.bindings.getKeys();
    expect(keys).toContain('root__c1');
    expect(keys).toContain('root__c2');
    expect(keys).toContain('root__c3');
    expect(keys).toHaveLength(3);
  });

  test('harness.resetBindings clears bindings and metrics', () => {
    const harness = getHarness();
    const c = new SpyControl(makeSpyConfig('x', 'root'), harness.metrics);
    harness.bindings.append(c);

    harness.resetBindings();

    expect(harness.metrics.all()).toHaveLength(0);
    expect(() => harness.bindings.fetch('root__x')).toThrow();
  });

  test('ControlRegistry.isGlobal returns true for the global bindings instance', () => {
    const harness = getHarness();
    expect(harness.bindings.isGlobal()).toBe(true);
  });

  test('subControls ControlRegistry is NOT the global bindings', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('q', 'root'), harness.metrics);
    expect(control.subControls.isGlobal()).toBe(false);
  });

  test('fetching a top-level control from local bindings succeeds', () => {
    const harness = getHarness();
    const c = new SpyControl(makeSpyConfig('m', 'root'), harness.metrics);
    harness.bindings.append(c);

    expect(harness.bindings.fetch('root__m')).toBe(c);
    expect(() => c.subControls.fetch('root__m')).toThrow();
  });

  test('building a three-level hierarchy and verifying all IDs', () => {
    const harness = getHarness();
    const gp = new SpyControl(makeSpyConfig('gp', 'root'), harness.metrics);
    harness.bindings.append(gp);

    const p = new SpyControl(makeSpyConfig('p', gp), harness.metrics);
    gp.appendChild(p);

    const c = new SpyControl(makeSpyConfig('c', p), harness.metrics);
    p.appendChild(c);

    expect(gp.getID()).toBe('root__gp');
    expect(p.getID()).toBe('root__gp__p');
    expect(c.getID()).toBe('root__gp__p__c');

    expect(harness.bindings.fetchGlobal('root__gp__p')).toBe(p);
    expect(harness.bindings.fetchGlobal('root__gp__p__c')).toBe(c);
  });
});

describe('ControlMetrics queries across multiple controls', () => {
  test('all() returns every recorded event across all controls', () => {
    const harness = getHarness();
    const c1 = new SpyControl(makeSpyConfig('r1', 'root'), harness.metrics);
    const c2 = new SpyControl(makeSpyConfig('r2', 'root'), harness.metrics);
    c1.setValue('v1');
    c2.setValue('v2');

    expect(harness.metrics.all().length).toBeGreaterThanOrEqual(4);
  });

  test('countEventType counts correctly across multiple controls', () => {
    const harness = getHarness();
    new SpyControl(makeSpyConfig('s1', 'root'), harness.metrics);
    new SpyControl(makeSpyConfig('s2', 'root'), harness.metrics);
    new SpyControl(makeSpyConfig('s3', 'root'), harness.metrics);

    expect(harness.metrics.countEventType('construct')).toBe(3);
  });
});
