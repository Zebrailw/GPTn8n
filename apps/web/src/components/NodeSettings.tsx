import { nodeDefinitions, type WorkflowNode } from '@pab/shared';

interface NodeSettingsProps {
  node: WorkflowNode | null;
  onChange: (data: Record<string, unknown>) => void;
}

export function NodeSettings({ node, onChange }: NodeSettingsProps) {
  if (!node) {
    return (
      <aside className="settings">
        <h3>Node Settings</h3>
        <p>Select a node to edit its parameters.</p>
      </aside>
    );
  }

  const definition = nodeDefinitions.find((item) => item.type === node.type);
  const params = (node.data?.params as Record<string, unknown>) ?? {};

  const updateParam = (name: string, value: unknown) => {
    onChange({
      params: {
        ...params,
        [name]: value
      }
    });
  };

  return (
    <aside className="settings">
      <h3>{definition?.label ?? node.type}</h3>
      {definition?.params.length ? (
        <div className="settings-form">
          {definition.params.map((param) => {
            const value = params[param.name] ?? '';
            if (param.type === 'boolean') {
              return (
                <label key={param.name}>
                  {param.name}
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => updateParam(param.name, event.target.checked)}
                  />
                </label>
              );
            }
            if (param.type === 'number') {
              return (
                <label key={param.name}>
                  {param.name}
                  <input
                    type="number"
                    value={Number(value)}
                    onChange={(event) =>
                      updateParam(param.name, Number(event.target.value))
                    }
                  />
                </label>
              );
            }
            if (param.type === 'json') {
              return (
                <label key={param.name}>
                  {param.name}
                  <textarea
                    value={value ? JSON.stringify(value, null, 2) : ''}
                    onChange={(event) => {
                      try {
                        const parsed = event.target.value
                          ? JSON.parse(event.target.value)
                          : {};
                        updateParam(param.name, parsed);
                      } catch {
                        updateParam(param.name, event.target.value);
                      }
                    }}
                    rows={5}
                  />
                </label>
              );
            }
            return (
              <label key={param.name}>
                {param.name}
                <input
                  type="text"
                  value={String(value)}
                  onChange={(event) => updateParam(param.name, event.target.value)}
                />
              </label>
            );
          })}
        </div>
      ) : (
        <p>No parameters.</p>
      )}
    </aside>
  );
}
