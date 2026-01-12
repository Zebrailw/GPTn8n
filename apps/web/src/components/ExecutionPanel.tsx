import { useEffect, useState } from 'react';
import axios from 'axios';
import type { ExecutionRecord, ExecutionStepRecord } from '@pab/shared';

interface ExecutionPanelProps {
  workflowId: string;
}

interface ExecutionDetail extends ExecutionRecord {
  steps: ExecutionStepRecord[];
}

export function ExecutionPanel({ workflowId }: ExecutionPanelProps) {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [selected, setSelected] = useState<ExecutionDetail | null>(null);

  useEffect(() => {
    const fetchExecutions = async () => {
      const { data } = await axios.get<ExecutionRecord[]>(
        `/api/executions?workflowId=${workflowId}`
      );
      setExecutions(data);
    };
    fetchExecutions();
    const interval = setInterval(fetchExecutions, 5000);
    return () => clearInterval(interval);
  }, [workflowId]);

  const loadExecution = async (id: string) => {
    const { data } = await axios.get<ExecutionDetail>(`/api/executions/${id}`);
    setSelected(data);
  };

  return (
    <section className="executions">
      <h3>Executions</h3>
      <div className="executions-content">
        <ul>
          {executions.map((execution) => (
            <li key={execution.id}>
              <button onClick={() => loadExecution(execution.id)}>
                <strong>{execution.status}</strong>
                <span>{new Date(execution.startedAt).toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="execution-details">
          {selected ? (
            <div>
              <h4>Execution {selected.id}</h4>
              {selected.steps.map((step) => (
                <div key={step.id} className="execution-step">
                  <strong>{step.nodeId}</strong>
                  <span>{step.status}</span>
                  <pre>{JSON.stringify(step.output ?? {}, null, 2)}</pre>
                  {step.logs?.length ? (
                    <pre>{JSON.stringify(step.logs, null, 2)}</pre>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p>Select an execution to inspect.</p>
          )}
        </div>
      </div>
    </section>
  );
}
