import type { NodeDefinition } from './types.js';

export const nodeDefinitions: NodeDefinition[] = [
  {
    type: 'manualTrigger',
    label: 'Manual Trigger',
    description: 'Starts a workflow manually.',
    params: []
  },
  {
    type: 'cronTrigger',
    label: 'Cron Trigger',
    description: 'Schedule workflow execution with cron.',
    params: [
      {
        name: 'cronExpression',
        type: 'string',
        required: true,
        description: 'Cron expression to trigger workflow.'
      }
    ]
  },
  {
    type: 'webhookTrigger',
    label: 'Webhook Trigger',
    description: 'Start workflow from an incoming webhook request.',
    params: [
      {
        name: 'path',
        type: 'string',
        required: true,
        description: 'Webhook path (without /api/webhooks/ prefix).'
      },
      {
        name: 'method',
        type: 'string',
        default: 'POST',
        description: 'HTTP method.'
      }
    ]
  },
  {
    type: 'httpRequest',
    label: 'HTTP Request',
    description: 'Perform an HTTP request.',
    params: [
      { name: 'method', type: 'string', default: 'GET' },
      { name: 'url', type: 'string', required: true },
      { name: 'headers', type: 'json' },
      { name: 'query', type: 'json' },
      { name: 'body', type: 'json' },
      { name: 'authType', type: 'string', description: 'basic or bearer' },
      { name: 'authUsername', type: 'string' },
      { name: 'authPassword', type: 'string' },
      { name: 'authToken', type: 'string' }
    ]
  },
  {
    type: 'code',
    label: 'Code',
    description: 'Run JavaScript to transform items.',
    params: [
      {
        name: 'code',
        type: 'string',
        required: true,
        description: 'JavaScript: (items) => items'
      }
    ]
  },
  {
    type: 'if',
    label: 'IF',
    description: 'Conditional branching.',
    outputs: ['true', 'false'],
    params: [
      {
        name: 'field',
        type: 'string',
        required: true,
        description: 'Field to check.'
      },
      {
        name: 'operator',
        type: 'string',
        default: 'equals',
        description: 'equals | notEquals | exists'
      },
      {
        name: 'value',
        type: 'string',
        description: 'Value to compare.'
      }
    ]
  },
  {
    type: 'set',
    label: 'Set',
    description: 'Set or rename fields.',
    params: [
      {
        name: 'fields',
        type: 'json',
        description: 'Object of fields to set.'
      }
    ]
  }
];
