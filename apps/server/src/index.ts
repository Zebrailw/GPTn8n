import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { z } from 'zod';
import { executeWorkflow } from './runtime/engine.js';
import { nodeDefinitions } from '@pab/shared';

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const webDist = path.resolve(process.cwd(), '../web/dist');
app.register(staticPlugin, {
  root: webDist,
  prefix: '/'
});

const workflowSchema = z.object({
  name: z.string(),
  active: z.boolean().default(false),
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      data: z.record(z.unknown()).optional()
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().nullable().optional(),
      targetHandle: z.string().nullable().optional()
    })
  )
});

const registerWebhooks = async (workflowId: string, nodes: unknown[]) => {
  await prisma.webhookEndpoint.deleteMany({ where: { workflowId } });
  const webhookNodes = nodes.filter(
    (node) =>
      typeof node === 'object' &&
      node !== null &&
      (node as { type?: string }).type === 'webhookTrigger'
  ) as Array<{ id: string; data?: { params?: Record<string, unknown> } }>;

  for (const node of webhookNodes) {
    const params = node.data?.params ?? {};
    const pathValue = String(params.path ?? '').replace(/^\//, '');
    if (!pathValue) {
      continue;
    }
    await prisma.webhookEndpoint.create({
      data: {
        workflowId,
        path: pathValue,
        method: String(params.method ?? 'POST').toUpperCase(),
        nodeId: node.id
      }
    });
  }
};

const rescheduleCron = async () => {
  cron.getTasks().forEach((task) => task.stop());
  const workflows = await prisma.workflow.findMany({ where: { active: true } });
  for (const workflow of workflows) {
    const nodes = workflow.nodes as Array<{ type: string; data?: { params?: Record<string, unknown> } }>;
    const cronNodes = nodes.filter((node) => node.type === 'cronTrigger');
    for (const node of cronNodes) {
      const expr = String(node.data?.params?.cronExpression ?? '');
      if (!expr) {
        continue;
      }
      cron.schedule(expr, async () => {
        await executeWorkflow(prisma, workflow, []);
      });
    }
  }
};

app.get('/api/nodes', async () => ({ nodes: nodeDefinitions }));

app.get('/api/workflows', async () => {
  const workflows = await prisma.workflow.findMany();
  return workflows;
});

app.post('/api/workflows', async (request) => {
  const payload = workflowSchema.parse(request.body);
  const workflow = await prisma.workflow.create({
    data: {
      name: payload.name,
      active: payload.active,
      nodes: payload.nodes,
      edges: payload.edges
    }
  });
  await registerWebhooks(workflow.id, payload.nodes);
  await rescheduleCron();
  return workflow;
});

app.get('/api/workflows/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) {
    return reply.code(404).send({ error: { message: 'Workflow not found' } });
  }
  return workflow;
});

app.put('/api/workflows/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const payload = workflowSchema.parse(request.body);
  const workflow = await prisma.workflow.update({
    where: { id },
    data: {
      name: payload.name,
      active: payload.active,
      nodes: payload.nodes,
      edges: payload.edges
    }
  });
  await registerWebhooks(workflow.id, payload.nodes);
  await rescheduleCron();
  return workflow;
});

app.delete('/api/workflows/:id', async (request) => {
  const { id } = request.params as { id: string };
  await prisma.webhookEndpoint.deleteMany({ where: { workflowId: id } });
  await prisma.executionStep.deleteMany({
    where: { execution: { workflowId: id } }
  });
  await prisma.execution.deleteMany({ where: { workflowId: id } });
  await prisma.workflow.delete({ where: { id } });
  await rescheduleCron();
  return { ok: true };
});

app.post('/api/workflows/:id/run', async (request, reply) => {
  const { id } = request.params as { id: string };
  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) {
    return reply.code(404).send({ error: { message: 'Workflow not found' } });
  }
  const executionId = await executeWorkflow(prisma, workflow, []);
  return { executionId };
});

app.get('/api/executions', async (request) => {
  const query = request.query as { workflowId?: string };
  const executions = await prisma.execution.findMany({
    where: query.workflowId ? { workflowId: query.workflowId } : {},
    orderBy: { startedAt: 'desc' }
  });
  return executions;
});

app.get('/api/executions/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const execution = await prisma.execution.findUnique({
    where: { id },
    include: { steps: { orderBy: { startedAt: 'asc' } } }
  });
  if (!execution) {
    return reply.code(404).send({ error: { message: 'Execution not found' } });
  }
  return execution;
});

app.all('/api/webhooks/:path', async (request, reply) => {
  const { path: hookPath } = request.params as { path: string };
  const webhook = await prisma.webhookEndpoint.findFirst({
    where: {
      path: hookPath,
      method: request.method
    },
    include: { workflow: true }
  });
  if (!webhook) {
    return reply.code(404).send({ error: { message: 'Webhook not found' } });
  }
  const payload = {
    body: request.body,
    headers: request.headers,
    query: request.query
  };
  const executionId = await executeWorkflow(
    prisma,
    webhook.workflow,
    [payload]
  );
  return { executionId };
});

app.get('*', async (_request, reply) => {
  return reply.sendFile('index.html');
});

const start = async () => {
  try {
    await prisma.$connect();
    await rescheduleCron();
    await app.listen({ port: 4000, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
