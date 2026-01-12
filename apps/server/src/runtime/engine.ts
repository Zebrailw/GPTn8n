import type { PrismaClient } from '@prisma/client';
import type { WorkflowEdge, WorkflowNode } from '@pab/shared';
import { nodeHandlers, type Items } from './nodes.js';

const buildAdjacency = (edges: WorkflowEdge[]) => {
  const adjacency = new Map<string, WorkflowEdge[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge);
    adjacency.set(edge.source, list);
  }
  return adjacency;
};

export const executeWorkflow = async (
  prisma: PrismaClient,
  workflow: { id: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  initialItems: Items
) => {
  const execution = await prisma.execution.create({
    data: {
      workflowId: workflow.id,
      status: 'running'
    }
  });

  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
  const adjacency = buildAdjacency(workflow.edges);
  const queue: string[] = [];
  const itemsByNode = new Map<string, Items>();

  const triggerNodes = workflow.nodes.filter((node) =>
    ['manualTrigger', 'cronTrigger', 'webhookTrigger'].includes(node.type)
  );

  if (triggerNodes.length === 0) {
    throw new Error('Workflow has no trigger node.');
  }

  for (const node of triggerNodes) {
    queue.push(node.id);
    itemsByNode.set(node.id, initialItems);
  }

  try {
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId) {
        continue;
      }
      const node = nodeMap.get(nodeId);
      if (!node) {
        continue;
      }
      const items = itemsByNode.get(nodeId) ?? [];
      const handler = nodeHandlers[node.type];
      if (!handler) {
        throw new Error(`No handler for node type ${node.type}`);
      }
      const step = await prisma.executionStep.create({
        data: {
          executionId: execution.id,
          nodeId: node.id,
          status: 'running',
          input: items
        }
      });

      const context = {
        logger: {
          info: (message: string, meta?: Record<string, unknown>) => {
            console.info(message, meta ?? {});
          }
        }
      };

      const result = await handler(node.data?.params, items, context);
      const outputDefault = result.default ?? [];
      const outputPayload = result.outputs ?? outputDefault;
      const outputWithLogs = result.logs
        ? { output: outputPayload, logs: result.logs }
        : outputPayload;

      await prisma.executionStep.update({
        where: { id: step.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
          output: outputWithLogs
        }
      });

      const outgoing = adjacency.get(nodeId) ?? [];
      if (result.outputs) {
        for (const edge of outgoing) {
          const handle = edge.sourceHandle ?? 'default';
          const outputItems = result.outputs[handle] ?? [];
          const existing = itemsByNode.get(edge.target) ?? [];
          itemsByNode.set(edge.target, [...existing, ...outputItems]);
          queue.push(edge.target);
        }
      } else {
        for (const edge of outgoing) {
          const existing = itemsByNode.get(edge.target) ?? [];
          itemsByNode.set(edge.target, [...existing, ...outputDefault]);
          queue.push(edge.target);
        }
      }
    }

    await prisma.execution.update({
      where: { id: execution.id },
      data: { status: 'success', finishedAt: new Date() }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await prisma.execution.update({
      where: { id: execution.id },
      data: { status: 'failed', finishedAt: new Date(), error: message }
    });
    throw error;
  }

  return execution.id;
};
