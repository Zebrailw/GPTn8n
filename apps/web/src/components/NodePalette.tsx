import { useMemo, useState } from 'react';
import type { NodeDefinition } from '@pab/shared';

interface NodePaletteProps {
  nodes: NodeDefinition[];
  onAddNode: (type: string) => void;
}

export function NodePalette({ nodes, onAddNode }: NodePaletteProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return nodes.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query)
    );
  }, [nodes, search]);

  return (
    <aside className="palette">
      <h3>Nodes</h3>
      <input
        placeholder="Search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="palette-list">
        {filtered.map((node) => (
          <button key={node.type} onClick={() => onAddNode(node.type)}>
            {node.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
