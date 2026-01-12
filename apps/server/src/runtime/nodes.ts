import axios from 'axios';
import { VM } from 'vm2';

export type Items = Array<Record<string, unknown>>;

export interface NodeExecuteContext {
  logger: { info: (message: string, meta?: Record<string, unknown>) => void };
}

export interface NodeExecutionResult {
  default?: Items;
  outputs?: Record<string, Items>;
  logs?: string[];
}

export type NodeExecute = (
  params: Record<string, unknown> | undefined,
  items: Items,
  context: NodeExecuteContext
) => Promise<NodeExecutionResult>;

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const getByPath = (item: Record<string, unknown>, path: string) => {
  if (!path) {
    return undefined;
  }
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, item);
};

export const nodeHandlers: Record<string, NodeExecute> = {
  manualTrigger: async (_params, items) => ({ default: items }),
  cronTrigger: async (_params, items) => ({ default: items }),
  webhookTrigger: async (_params, items) => ({ default: items }),
  httpRequest: async (params, _items) => {
    const config = asObject(params);
    const method = String(config.method ?? 'GET').toLowerCase();
    const url = String(config.url ?? '');
    if (!url) {
      throw new Error('HTTP Request node requires url');
    }
    const headers = asObject(config.headers);
    const query = asObject(config.query);
    const body = config.body;
    if (config.authType === 'basic') {
      const username = String(config.authUsername ?? '');
      const password = String(config.authPassword ?? '');
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      headers.authorization = `Basic ${token}`;
    }
    if (config.authType === 'bearer') {
      const token = String(config.authToken ?? '');
      headers.authorization = `Bearer ${token}`;
    }
    const response = await axios.request({
      method,
      url,
      headers,
      params: query,
      data: body
    });
    return {
      default: [
        {
          status: response.status,
          data: response.data,
          headers: response.headers
        }
      ]
    };
  },
  code: async (params, items, context) => {
    const code = String(params?.code ?? '');
    if (!code) {
      throw new Error('Code node requires code');
    }
    const logs: string[] = [];
    const vm = new VM({
      timeout: 1000,
      sandbox: {
        items,
        console: {
          log: (...args: unknown[]) => {
            logs.push(args.map((arg) => JSON.stringify(arg)).join(' '));
          }
        }
      },
      eval: false,
      wasm: false
    });
    const result = vm.run(`(function() { const userFn = ${code}; return userFn(items); })()`);
    if (!Array.isArray(result)) {
      throw new Error('Code node must return an array of items');
    }
    context.logger.info('Code node logs', { logs });
    return { default: result as Items, logs };
  },
  if: async (params, items) => {
    const field = String(params?.field ?? '');
    const operator = String(params?.operator ?? 'equals');
    const value = params?.value;
    const truthy: Items = [];
    const falsy: Items = [];
    for (const item of items) {
      const fieldValue = getByPath(item, field);
      let result = false;
      if (operator === 'exists') {
        result = fieldValue !== undefined && fieldValue !== null;
      } else if (operator === 'notEquals') {
        result = fieldValue !== value;
      } else {
        result = fieldValue === value;
      }
      if (result) {
        truthy.push(item);
      } else {
        falsy.push(item);
      }
    }
    return { outputs: { true: truthy, false: falsy } };
  },
  set: async (params, items) => {
    const fields = asObject(params?.fields);
    return {
      default: items.map((item) => ({ ...item, ...fields }))
    };
  }
};
