import { useControlHarness } from '../src/harnessHooks';
import { SpyControl, makeSpyConfig } from '../src/SpyControl';
import { EventSimulator } from '../src/EventSimulator';

const getHarness = useControlHarness();

describe('SpyControl eventLinkage and onChildEvent metrics', () => {
  test('eventLinkage is recorded when called directly on a root control', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('root_ctrl', 'root'), harness.metrics);
    control.eventLinkage('some-value');

    const events = harness.metrics
      .getEventsFor('root__root_ctrl')
      .filter((e) => e.event === 'eventLinkage');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ stateChange: 'some-value' });
  });

  test('eventLinkage on a child triggers onChildEvent on the parent', () => {
    const harness = getHarness();
    const parent = new SpyControl(makeSpyConfig('parent', 'root'), harness.metrics);
    const child = new SpyControl(makeSpyConfig('child', parent), harness.metrics);

    child.eventLinkage('change-payload');

    const parentOnChild = harness.metrics
      .getEventsFor('root__parent')
      .filter((e) => e.event === 'onChildEvent');
    expect(parentOnChild).toHaveLength(1);
    expect(parentOnChild[0].payload).toMatchObject({ stateChange: 'change-payload' });

    const childLinkage = harness.metrics
      .getEventsFor('root__parent__child')
      .filter((e) => e.event === 'eventLinkage');
    expect(childLinkage).toHaveLength(1);
  });

  test('eventLinkage on a root control (no parent) does NOT trigger onChildEvent', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('solo', 'root'), harness.metrics);
    control.eventLinkage('test');

    expect(harness.metrics.countEventType('onChildEvent')).toBe(0);
  });

  test('onChildEvent payload contains the stateChange value', () => {
    const harness = getHarness();
    const parent = new SpyControl(makeSpyConfig('p', 'root'), harness.metrics);
    const child = new SpyControl(makeSpyConfig('c', parent), harness.metrics);

    child.eventLinkage({ key: 'value', checked: true });

    const events = harness.metrics
      .getEventsFor('root__p')
      .filter((e) => e.event === 'onChildEvent');
    expect(events[0].payload?.stateChange).toMatchObject({ key: 'value', checked: true });
  });

  test('EventSimulator.dispatchClick fires a click event on a DOM element', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('clicker', 'root'), harness.metrics);
    const el = control.getElement();

    let clicked = false;
    el.addEventListener('click', () => {
      clicked = true;
    });

    EventSimulator.dispatchClick(el);
    expect(clicked).toBe(true);
  });

  test('EventSimulator.dispatchCustom fires a custom event with detail', () => {
    const harness = getHarness();
    const control = new SpyControl(makeSpyConfig('customEvt', 'root'), harness.metrics);
    const el = control.getElement();

    let receivedDetail: unknown;
    el.addEventListener('my-event', ((e: CustomEvent) => {
      receivedDetail = e.detail;
    }) as EventListener);

    EventSimulator.dispatchCustom(el, 'my-event', { foo: 'bar' });
    expect(receivedDetail).toMatchObject({ foo: 'bar' });
  });

  test('EventSimulator.dispatchChange fires a change event', () => {
    const inputEl = document.createElement('input');
    inputEl.type = 'checkbox';
    inputEl.id = 'test-input';
    document.body.appendChild(inputEl);

    let changed = false;
    inputEl.addEventListener('change', () => {
      changed = true;
    });

    EventSimulator.dispatchChange(inputEl);
    expect(changed).toBe(true);

    document.body.removeChild(inputEl);
  });

  test('full integration: click handler -> eventLinkage -> parent onChildEvent chain', () => {
    const harness = getHarness();
    const parent = new SpyControl(makeSpyConfig('par', 'root'), harness.metrics);
    const child = new SpyControl(makeSpyConfig('ch', parent), harness.metrics);

    const childEl = child.getElement();

    childEl.addEventListener('click', () => child.eventLinkage('button-clicked'));

    EventSimulator.dispatchClick(childEl);

    const linkageEvents = harness.metrics
      .getEventsFor('root__par__ch')
      .filter((e) => e.event === 'eventLinkage');
    expect(linkageEvents).toHaveLength(1);
    expect(linkageEvents[0].payload).toMatchObject({ stateChange: 'button-clicked' });

    const onChildEvents = harness.metrics
      .getEventsFor('root__par')
      .filter((e) => e.event === 'onChildEvent');
    expect(onChildEvents).toHaveLength(1);
    expect(onChildEvents[0].payload).toMatchObject({ stateChange: 'button-clicked' });

    expect(
      harness.metrics.assertSequence('root__par__ch', ['construct', 'getElement', 'eventLinkage']),
    ).toBe(true);
  });
});
