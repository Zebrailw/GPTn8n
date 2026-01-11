import { useMemo, useState } from 'react';
import { nodeDefinitions } from '@pab/shared';

interface NodePaletteProps {
  onAddNode: (type: string) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return nodeDefinitions.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query)
    );
  }, [search]);

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
