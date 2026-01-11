import { describe, expect, it } from 'vitest';
import { nodeHandlers } from '../src/runtime/nodes.js';

describe('node handlers', () => {
  it('set node merges fields', async () => {
    const result = await nodeHandlers.set(
      { fields: { hello: 'world' } },
      [{ id: 1 }],
      { logger: { info: () => undefined } }
    );
    expect(result.default).toEqual([{ id: 1, hello: 'world' }]);
  });

  it('if node splits outputs', async () => {
    const result = await nodeHandlers.if(
      { field: 'status', operator: 'equals', value: 'ok' },
      [{ status: 'ok' }, { status: 'fail' }],
      { logger: { info: () => undefined } }
    );
    expect(result.outputs?.true).toHaveLength(1);
    expect(result.outputs?.false).toHaveLength(1);
  });
});
