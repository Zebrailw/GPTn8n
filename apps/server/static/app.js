const state = {
  workflow: null,
  nodes: [],
  edges: [],
  nodeDefinitions: [],
  selectedNodeId: null
};

const api = {
  async getNodes() {
    const response = await fetch('/api/nodes');
    return response.json();
  },
  async listWorkflows() {
    const response = await fetch('/api/workflows');
    return response.json();
  },
  async createWorkflow(payload) {
    const response = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  },
  async updateWorkflow(id, payload) {
    const response = await fetch(`/api/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  },
  async runWorkflow(id) {
    await fetch(`/api/workflows/${id}/run`, { method: 'POST' });
  },
  async listExecutions(workflowId) {
    const response = await fetch(`/api/executions?workflowId=${workflowId}`);
    return response.json();
  },
  async getExecution(id) {
    const response = await fetch(`/api/executions/${id}`);
    return response.json();
  }
};

const elements = {
  paletteList: document.getElementById('palette-list'),
  nodeSearch: document.getElementById('node-search'),
  nodesLayer: document.getElementById('nodes'),
  edgesLayer: document.getElementById('edges'),
  workflowName: document.getElementById('workflow-name'),
  saveBtn: document.getElementById('save-btn'),
  runBtn: document.getElementById('run-btn'),
  activeToggle: document.getElementById('active-toggle'),
  nodeSettings: document.getElementById('node-settings'),
  executionsList: document.getElementById('executions-list'),
  executionDetails: document.getElementById('execution-details')
};

function getNodeDefinition(type) {
  return state.nodeDefinitions.find((node) => node.type === type);
}

function defaultWorkflow() {
  return {
    name: 'My Workflow',
    active: false,
    nodes: [
      {
        id: `node-${Date.now()}`,
        type: 'manualTrigger',
        position: { x: 120, y: 120 },
        data: { label: 'Manual Trigger', params: {} }
      }
    ],
    edges: []
  };
}

function renderPalette() {
  const query = elements.nodeSearch.value.toLowerCase();
  elements.paletteList.innerHTML = '';
  state.nodeDefinitions
    .filter(
      (node) =>
        node.label.toLowerCase().includes(query) || node.type.toLowerCase().includes(query)
    )
    .forEach((node) => {
      const button = document.createElement('button');
      button.textContent = node.label;
      button.addEventListener('click', () => addNode(node.type));
      elements.paletteList.appendChild(button);
    });
}

function addNode(type) {
  const definition = getNodeDefinition(type);
  if (!definition) return;
  const node = {
    id: `node-${Date.now()}`,
    type,
    position: { x: 200, y: 200 },
    data: { label: definition.label, params: {} }
  };
  state.nodes.push(node);
  renderCanvas();
}

function renderCanvas() {
  elements.nodesLayer.innerHTML = '';
  state.nodes.forEach((node) => {
    const div = document.createElement('div');
    div.className = 'node';
    if (node.id === state.selectedNodeId) {
      div.classList.add('selected');
    }
    div.style.left = `${node.position.x}px`;
    div.style.top = `${node.position.y}px`;
    div.dataset.nodeId = node.id;
    div.innerHTML = `<strong>${node.data.label || node.type}</strong><small>${node.type}</small>`;
    div.addEventListener('mousedown', (event) => startDrag(event, node));
    div.addEventListener('click', (event) => {
      event.stopPropagation();
      state.selectedNodeId = node.id;
      renderCanvas();
      renderSettings();
    });
    elements.nodesLayer.appendChild(div);
  });
  drawEdges();
}

function drawEdges() {
  elements.edgesLayer.innerHTML = '';
  const rect = elements.nodesLayer.getBoundingClientRect();
  elements.edgesLayer.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  state.edges.forEach((edge) => {
    const source = state.nodes.find((n) => n.id === edge.source);
    const target = state.nodes.find((n) => n.id === edge.target);
    if (!source || !target) return;
    const startX = source.position.x + 140;
    const startY = source.position.y + 24;
    const endX = target.position.x;
    const endY = target.position.y + 24;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', startX);
    line.setAttribute('y1', startY);
    line.setAttribute('x2', endX);
    line.setAttribute('y2', endY);
    line.setAttribute('stroke', '#2563eb');
    line.setAttribute('stroke-width', '2');
    elements.edgesLayer.appendChild(line);
  });
}

let dragState = null;

function startDrag(event, node) {
  dragState = {
    node,
    offsetX: event.offsetX,
    offsetY: event.offsetY
  };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
}

function onDrag(event) {
  if (!dragState) return;
  const canvasRect = elements.nodesLayer.getBoundingClientRect();
  dragState.node.position.x = event.clientX - canvasRect.left - dragState.offsetX;
  dragState.node.position.y = event.clientY - canvasRect.top - dragState.offsetY;
  renderCanvas();
}

function stopDrag() {
  dragState = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

function renderSettings() {
  const container = elements.nodeSettings;
  container.innerHTML = '';
  const node = state.nodes.find((n) => n.id === state.selectedNodeId);
  if (!node) {
    container.textContent = 'Select a node to edit its parameters.';
    return;
  }
  const definition = getNodeDefinition(node.type);
  const params = node.data.params || {};
  const title = document.createElement('h4');
  title.textContent = definition?.label || node.type;
  container.appendChild(title);

  const form = document.createElement('div');
  form.className = 'settings-form';
  (definition?.params || []).forEach((param) => {
    const label = document.createElement('label');
    label.textContent = param.name;
    if (param.type === 'json') {
      const textarea = document.createElement('textarea');
      textarea.rows = 4;
      textarea.value = params[param.name] ? JSON.stringify(params[param.name], null, 2) : '';
      textarea.addEventListener('change', () => {
        try {
          params[param.name] = textarea.value ? JSON.parse(textarea.value) : {};
        } catch {
          params[param.name] = textarea.value;
        }
        node.data.params = params;
      });
      label.appendChild(textarea);
    } else if (param.type === 'boolean') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(params[param.name]);
      input.addEventListener('change', () => {
        params[param.name] = input.checked;
        node.data.params = params;
      });
      label.appendChild(input);
    } else {
      const input = document.createElement('input');
      input.type = param.type === 'number' ? 'number' : 'text';
      input.value = params[param.name] ?? '';
      input.addEventListener('input', () => {
        params[param.name] = input.value;
        node.data.params = params;
      });
      label.appendChild(input);
    }
    form.appendChild(label);
  });

  const connectTitle = document.createElement('h5');
  connectTitle.textContent = 'Connect to';
  const connectionRow = document.createElement('div');
  connectionRow.className = 'connection-row';
  const targetSelect = document.createElement('select');
  state.nodes
    .filter((target) => target.id !== node.id)
    .forEach((target) => {
      const option = document.createElement('option');
      option.value = target.id;
      option.textContent = `${target.data.label || target.type} (${target.id})`;
      targetSelect.appendChild(option);
    });
  const handleSelect = document.createElement('select');
  if (node.type === 'if') {
    ['true', 'false'].forEach((handle) => {
      const option = document.createElement('option');
      option.value = handle;
      option.textContent = handle;
      handleSelect.appendChild(option);
    });
  } else {
    const option = document.createElement('option');
    option.value = 'default';
    option.textContent = 'default';
    handleSelect.appendChild(option);
  }
  const connectBtn = document.createElement('button');
  connectBtn.textContent = 'Add Edge';
  connectBtn.addEventListener('click', () => {
    if (!targetSelect.value) return;
    state.edges.push({
      id: `edge-${Date.now()}`,
      source: node.id,
      target: targetSelect.value,
      sourceHandle: handleSelect.value === 'default' ? null : handleSelect.value
    });
    renderCanvas();
  });
  connectionRow.appendChild(targetSelect);
  connectionRow.appendChild(handleSelect);
  connectionRow.appendChild(connectBtn);

  form.appendChild(connectTitle);
  form.appendChild(connectionRow);

  container.appendChild(form);
}

async function saveWorkflow() {
  if (!state.workflow) return;
  const payload = {
    name: elements.workflowName.value,
    active: elements.activeToggle.checked,
    nodes: state.nodes,
    edges: state.edges
  };
  const updated = await api.updateWorkflow(state.workflow.id, payload);
  state.workflow = updated;
}

async function runWorkflow() {
  if (!state.workflow) return;
  await api.runWorkflow(state.workflow.id);
  await loadExecutions();
}

async function loadExecutions() {
  if (!state.workflow) return;
  const executions = await api.listExecutions(state.workflow.id);
  elements.executionsList.innerHTML = '';
  executions.forEach((execution) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.innerHTML = `<strong>${execution.status}</strong><span>${new Date(
      execution.startedAt
    ).toLocaleString()}</span>`;
    btn.addEventListener('click', async () => {
      const detail = await api.getExecution(execution.id);
      renderExecutionDetail(detail);
    });
    li.appendChild(btn);
    elements.executionsList.appendChild(li);
  });
}

function renderExecutionDetail(detail) {
  elements.executionDetails.innerHTML = '';
  const title = document.createElement('h4');
  title.textContent = `Execution ${detail.id}`;
  elements.executionDetails.appendChild(title);
  detail.steps.forEach((step) => {
    const container = document.createElement('div');
    container.className = 'execution-step';
    container.innerHTML = `<strong>${step.nodeId}</strong><span>${step.status}</span>`;
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(step.output || {}, null, 2);
    container.appendChild(pre);
    elements.executionDetails.appendChild(container);
  });
}

async function init() {
  const nodes = await api.getNodes();
  state.nodeDefinitions = nodes.nodes;

  const workflows = await api.listWorkflows();
  if (workflows.length) {
    state.workflow = workflows[0];
    state.nodes = workflows[0].nodes;
    state.edges = workflows[0].edges;
  } else {
    state.workflow = await api.createWorkflow(defaultWorkflow());
    state.nodes = state.workflow.nodes;
    state.edges = state.workflow.edges;
  }

  elements.workflowName.value = state.workflow.name;
  elements.activeToggle.checked = state.workflow.active;

  renderPalette();
  renderCanvas();
  renderSettings();
  await loadExecutions();
  setInterval(loadExecutions, 5000);
}

function setupEvents() {
  elements.nodeSearch.addEventListener('input', renderPalette);
  elements.saveBtn.addEventListener('click', saveWorkflow);
  elements.runBtn.addEventListener('click', runWorkflow);
  elements.activeToggle.addEventListener('change', saveWorkflow);
  document.getElementById('canvas').addEventListener('click', () => {
    state.selectedNodeId = null;
    renderCanvas();
    renderSettings();
  });
}

setupEvents();
init();
