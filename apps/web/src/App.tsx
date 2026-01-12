import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  Connection
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { nodeDefinitions, type WorkflowNode } from '@pab/shared';
import { NodePalette } from './components/NodePalette';
import { NodeSettings } from './components/NodeSettings';
import { ExecutionPanel } from './components/ExecutionPanel';
import { NodeRenderer } from './components/NodeRenderer';

interface WorkflowApiRecord {
  id: string;
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string | null }>;
}

const emptyWorkflow = (): Omit<WorkflowApiRecord, 'id'> => ({
  name: 'My Workflow',
  active: false,
  nodes: [
    {
      id: 'node-1',
      type: 'manualTrigger',
      position: { x: 120, y: 120 },
      data: { label: 'Manual Trigger', params: {} }
    }
  ],
  edges: []
});

export default function App() {
  const [workflow, setWorkflow] = useState<WorkflowApiRecord | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodeTypes = useMemo(() => {
    const entries = nodeDefinitions.map((definition) => [definition.type, NodeRenderer]);
    return Object.fromEntries(entries) as Record<string, typeof NodeRenderer>;
  }, []);

  useEffect(() => {
    const loadWorkflow = async () => {
      const { data } = await axios.get<WorkflowApiRecord[]>('/api/workflows');
      if (data.length > 0) {
        setWorkflow(data[0]);
        setNodes(data[0].nodes);
        setEdges(data[0].edges);
      } else {
        const created = await axios.post<WorkflowApiRecord>('/api/workflows', emptyWorkflow());
        setWorkflow(created.data);
        setNodes(created.data.nodes);
        setEdges(created.data.edges);
      }
    };
    loadWorkflow();
  }, [setEdges, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const updateSelectedNode = (data: Record<string, unknown>) => {
    if (!selectedNode) {
      return;
    }
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, ...data } }
          : node
      )
    );
  };

  const handleAddNode = (type: string) => {
    const definition = nodeDefinitions.find((node) => node.type === type);
    if (!definition) {
      return;
    }
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      position: { x: 200, y: 200 },
      data: { label: definition.label, params: {} }
    };
    setNodes((current) => [...current, newNode]);
  };

  const saveWorkflow = async () => {
    if (!workflow) {
      return;
    }
    const payload = { ...workflow, nodes, edges };
    const { data } = await axios.put(`/api/workflows/${workflow.id}`, payload);
    setWorkflow(data);
  };

  const runWorkflow = async () => {
    if (!workflow) {
      return;
    }
    await axios.post(`/api/workflows/${workflow.id}/run`);
  };

  const toggleActive = async () => {
    if (!workflow) {
      return;
    }
    const updated = { ...workflow, active: !workflow.active, nodes, edges };
    const { data } = await axios.put(`/api/workflows/${workflow.id}`, updated);
    setWorkflow(data);
  };

  if (!workflow) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <ReactFlowProvider>
      <div className="app">
        <header className="topbar">
          <input
            className="workflow-name"
            value={workflow.name}
            onChange={(event) => setWorkflow({ ...workflow, name: event.target.value })}
          />
          <div className="topbar-actions">
            <button onClick={saveWorkflow}>Save</button>
            <button onClick={runWorkflow}>Run</button>
            <label className="toggle">
              <input type="checkbox" checked={workflow.active} onChange={toggleActive} />
              Active
            </label>
          </div>
        </header>
        <div className="content">
          <NodePalette onAddNode={handleAddNode} />
          <main className="canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
            <ExecutionPanel workflowId={workflow.id} />
          </main>
          <NodeSettings node={selectedNode} onChange={updateSelectedNode} />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
