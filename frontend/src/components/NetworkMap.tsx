import React from 'react';
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
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const incidentMap = new Map<string, IncidentSummary>();
  for (const incident of incidents) if (incident.status !== 'CLEARED' && !incident.dismissedAt && !incidentMap.has(incident.edgeId)) incidentMap.set(incident.edgeId, incident);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
        <h2 className="text-sm font-semibold text-slate-200">Demonstration Pedestrian Network Schematic</h2>
        <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Maple Ward</span>
      </div>

      <div className="relative w-full aspect-[6/4] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
        <svg
          viewBox="0 0 600 400"
          className="w-full h-full select-none"
          role="group"
          aria-label="Interactive map schematic of the 8 demonstration nodes and pedestrian walkways"
        >
          <defs>
            {/* Glow filter for highlighted active route */}
            <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid background markers for reference */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
          </pattern>
          <rect width="600" height="400" fill="url(#grid)" />

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

            let strokeColor = '#475569'; // default slate-600
            let strokeWidth = 3;
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
              strokeWidth = 5;
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
                className="cursor-pointer transition-all hover:opacity-80 focus:outline-emerald-400"
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
                  filter={isRouteEdge ? 'url(#route-glow)' : undefined}
                />

                {/* Edge distance & hazard badge at midpoint */}
                <circle cx={midX} cy={midY} r={11} fill="#0f172a" stroke={strokeColor} strokeWidth={1.5} />
                <text
                  x={midX}
                  y={midY + 3.5}
                  fontSize={8}
                  fill="#cbd5e1"
                  textAnchor="middle"
                  className="font-mono font-medium pointer-events-none"
                >
                  {isBlocked ? '✕' : edge.has_steps ? '⑂' : `${edge.length_m}m`}
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
                className="cursor-pointer focus:outline-emerald-400"
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
                  r={isRouteNode ? 18 : 14}
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
                  fontSize={10}
                  fontWeight="500"
                  fill="#94a3b8"
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
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-5 h-1.5 bg-emerald-500 rounded-full inline-block" />
          <span>Active Route</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-1.5 bg-slate-600 rounded-full inline-block" />
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
      </div>
    </div>
  );
};
