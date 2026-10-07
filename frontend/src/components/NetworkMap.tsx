import React, { useId } from 'react';
import { Node, Edge, IncidentSummary } from '../types';

interface NetworkMapProps {
  nodes: Node[];
  edges: Edge[];
  incidents?: IncidentSummary[];
  highlightEdgeIds?: string[];
  highlightNodeIds?: string[];
  selectedEdgeId?: string;
  onSelectEdge?: (edgeId: string) => void;
  onSelectNode?: (nodeId: string) => void;
}

export const NetworkMap: React.FC<NetworkMapProps> = ({
  nodes,
  edges,
  incidents = [],
  highlightEdgeIds = [],
  highlightNodeIds = [],
  selectedEdgeId,
  onSelectEdge,
  onSelectNode,
}) => {
  const mapId = useId().replace(/:/g, '');
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const incidentMap = new Map<string, IncidentSummary>();
  for (const incident of incidents) if (incident.status !== 'CLEARED' && !incident.dismissedAt && !incidentMap.has(incident.edgeId)) incidentMap.set(incident.edgeId, incident);

  return (
    <div className="surface p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
        <h2 className="text-sm font-semibold text-slate-200">Pedestrian network</h2>
        <span className="text-xs text-slate-400">Illustrative schematic</span>
      </div>

      <div className="relative w-full aspect-[6/4] bg-[#0c1926] rounded-xl overflow-hidden border border-slate-700/60 flex items-center justify-center">
        <svg
          viewBox="-10 -10 620 420"
          className="w-full h-full select-none"
          role="group"
          aria-label={`Map schematic of ${nodes.length} demonstration landmarks and ${edges.length} pedestrian walkways`}
        >
          <defs>
            {/* Glow filter for highlighted active route */}
            <filter id={`${mapId}-route-glow`} filterUnits="userSpaceOnUse" x="-10" y="-10" width="620" height="420">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid background markers for reference */}
          <pattern id={`${mapId}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#314155" strokeWidth="0.5" opacity=".4" />
          </pattern>
          <rect x="-10" y="-10" width="620" height="420" fill={`url(#${mapId}-grid)`} />
          <g aria-hidden="true" opacity=".65">
            <rect x="214" y="84" width="94" height="60" rx="12" fill="#143631" stroke="#22534b" />
            <rect x="214" y="222" width="246" height="58" rx="12" fill="#182e40" stroke="#264155" />
            <path d="M42 278 Q93 233 130 259 Q153 286 117 326 Q70 346 42 312Z" fill="#143631" stroke="#22534b" />
            <circle cx="240" cy="105" r="7" fill="#23554b" /><circle cx="273" cy="113" r="9" fill="#23554b" /><circle cx="100" cy="281" r="12" fill="#23554b" />
            <text x="260" y="134" fontSize="8" fill="#8db2a9" textAnchor="middle" letterSpacing="1">GARDEN</text>
            <text x="335" y="254" fontSize="9" fill="#849caf" textAnchor="middle" letterSpacing="2">MAPLE WARD</text>
          </g>

          {/* Render Edges / Walkways */}
          {edges.map((edge) => {
            const from = nodeMap.get(edge.from_node);
            const to = nodeMap.get(edge.to_node);
            if (!from || !to) return null;

            const isRouteEdge = highlightEdgeIds.includes(edge.id);
            const isSelected = selectedEdgeId === edge.id;
            const inc = incidentMap.get(edge.id);
            const isBlocked = inc && inc.status === 'CONFIRMED_BLOCKED';
            const isUnverified = inc && inc.status === 'UNVERIFIED';

            let strokeColor = '#7b91a8';
            let strokeWidth = 5;
            let strokeDasharray = 'none';

            if (edge.has_steps) {
              strokeColor = '#d97706'; // amber-600 for stairs
              strokeDasharray = '4 4';
            } else if (edge.step_free_status === 'UNKNOWN') {
              strokeColor = '#64748b'; // slate-500
              strokeDasharray = '2 2';
            }

            if (isUnverified) {
              strokeColor = '#eab308'; // yellow-500
              strokeDasharray = '6 3';
            }

            if (isBlocked) {
              strokeColor = '#ef4444'; // red-500
              strokeDasharray = '6 4';
              strokeWidth = 4;
            }

            if (isRouteEdge) {
              strokeColor = '#10b981'; // emerald-500
              strokeWidth = 7;
              strokeDasharray = 'none';
            }

            if (isSelected) {
              strokeColor = '#38bdf8'; // sky-400
              strokeWidth = 5;
            }

            const midX = (from.map_x + to.map_x) / 2;
            const midY = (from.map_y + to.map_y) / 2;

            return (
              <g
                key={edge.id}
                className={onSelectEdge ? 'cursor-pointer transition-opacity hover:opacity-80 focus:outline-emerald-400' : ''}
                onClick={() => onSelectEdge && onSelectEdge(edge.id)}
                role={onSelectEdge ? "button" : undefined}
                tabIndex={onSelectEdge ? 0 : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectEdge && onSelectEdge(edge.id);
                  }
                }}
                aria-label={`Walkway segment ${edge.id}: ${edge.name}, length ${edge.length_m} meters${
                  edge.has_steps ? ', contains stairs' : ''
                }${isBlocked ? ', confirmed blocked' : ''}`}
              >
                {/* Thick invisible line for easier click detection */}
                <line
                  x1={from.map_x}
                  y1={from.map_y}
                  x2={to.map_x}
                  y2={to.map_y}
                  stroke="transparent"
                  strokeWidth={20}
                />

                {/* Visible pathway line */}
                <line
                  x1={from.map_x}
                  y1={from.map_y}
                  x2={to.map_x}
                  y2={to.map_y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeLinecap="round"
                  filter={isRouteEdge ? `url(#${mapId}-route-glow)` : undefined}
                />

                {/* Edge distance & hazard badge at midpoint */}
                <rect x={midX - 20} y={midY - 11} width={40} height={22} rx={7} fill="#102131" stroke={strokeColor} strokeWidth={1} />
                <text
                  x={midX}
                  y={midY + 3.5}
                  fontSize={10}
                  fill="#e2e8f0"
                  textAnchor="middle"
                  className="font-mono font-medium pointer-events-none"
                >
                  {isBlocked ? 'Blocked' : edge.has_steps ? 'Stairs' : `${edge.length_m}m`}
                </text>
              </g>
            );
          })}

          {/* Render Nodes / Junctions */}
          {nodes.map((node) => {
            const isRouteNode = highlightNodeIds.includes(node.id);

            return (
              <g
                key={node.id}
                className={onSelectNode ? 'cursor-pointer focus:outline-emerald-400' : ''}
                onClick={() => onSelectNode && onSelectNode(node.id)}
                role={onSelectNode ? "button" : undefined}
                tabIndex={onSelectNode ? 0 : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectNode && onSelectNode(node.id);
                  }
                }}
                aria-label={`Node ${node.id}: ${node.name}`}
              >
                {/* Node outer ring */}
                <circle
                  cx={node.map_x}
                  cy={node.map_y}
                  r={isRouteNode ? 19 : 16}
                  fill={isRouteNode ? '#065f46' : '#1e293b'}
                  stroke={isRouteNode ? '#34d399' : '#64748b'}
                  strokeWidth={isRouteNode ? 3 : 2}
                  className="transition-all hover:scale-110"
                />

                {/* Node identifier letter */}
                <text
                  x={node.map_x}
                  y={node.map_y + 4.5}
                  fontSize={12}
                  fontWeight="bold"
                  fill="#ffffff"
                  textAnchor="middle"
                  className="pointer-events-none select-none font-sans"
                >
                  {node.id}
                </text>

                {/* Node name label */}
                <text
                  x={node.map_x}
                  y={node.map_y + (node.map_y < 120 ? -20 : 28)}
                  fontSize={11}
                  fontWeight="500"
                  fill="#cbd5e1"
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Accessible Map Legend */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="w-5 h-1.5 bg-emerald-500 rounded-full inline-block" />
          <span>Active Route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-1.5 bg-slate-400 rounded-full inline-block shrink-0" />
          <span>Step-Free Walkway</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-1.5 border-b-2 border-amber-500 border-dashed inline-block" />
          <span>Stairs (Non-Step-Free)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-1.5 border-b-2 border-red-500 border-dashed inline-block" />
          <span>Blocked Obstruction</span>
        </div>
        <div className="flex items-center gap-2"><span className="w-5 h-1.5 border-b-2 border-yellow-400 border-dashed inline-block shrink-0" /><span>Unverified report</span></div>
        <div className="flex items-center gap-2"><span className="w-5 h-1.5 border-b-2 border-slate-400 border-dotted inline-block shrink-0" /><span>Access unknown</span></div>
      </div>
      {(onSelectNode || onSelectEdge) && <p className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400">Choose a landmark to change your destination. Select a walkway to inspect its reports.</p>}
    </div>
  );
};
