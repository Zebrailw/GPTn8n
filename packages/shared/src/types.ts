export type NodeParamType = 'string' | 'number' | 'boolean' | 'json' | 'code';

export interface NodeParamSchema {
  name: string;
  type: NodeParamType;
  default?: unknown;
  required?: boolean;
  description?: string;
}

export interface NodeDefinition {
  type: string;
  label: string;
  description?: string;
  params: NodeParamSchema[];
  outputs?: string[];
  inputs?: number;
}

export interface WorkflowNodeData {
  label?: string;
  params?: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export type ExecutionStatus = 'running' | 'success' | 'failed';

export interface WorkflowRecord {
  id: string;
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt?: string | null;
  error?: string | null;
}

export interface ExecutionStepRecord {
  id: string;
  executionId: string;
  nodeId: string;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt?: string | null;
  input?: unknown;
  output?: unknown;
  logs?: string[];
  error?: string | null;
}
