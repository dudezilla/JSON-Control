import { ControlHarness } from './ControlHarness';

export interface HarnessHandle {
  harness: ControlHarness;
}

export function useControlHarness(bodyHtml?: string): () => ControlHarness {
  const handle: HarnessHandle = { harness: null! };

  beforeEach(() => {
    handle.harness = new ControlHarness(bodyHtml);
  });

  afterEach(() => {
    handle.harness.teardown();
  });

  return () => handle.harness;
}
