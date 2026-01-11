import { Handle, Position, type NodeProps } from 'reactflow';

export function NodeRenderer({ data, type }: NodeProps) {
  const isTrigger = ['manualTrigger', 'cronTrigger', 'webhookTrigger'].includes(type);
  const isIf = type === 'if';

  return (
    <div className="node">
      {!isTrigger && <Handle type="target" position={Position.Left} />}
      <strong>{data?.label ?? type ?? 'Node'}</strong>
      {isIf ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ top: '35%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{ top: '65%' }}
          />
        </>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}
