import { EdgeRecord, NodeRecord } from '../repositories/network.js';
import { IncidentRecord } from '../repositories/incidents.js';
import { ReportRecord } from '../repositories/reports.js';

export type ProfileType = 'GENERAL_WALK' | 'STEP_FREE';

export interface RouteStep {
  stepIndex: number;
  fromNodeId: string;
  fromNodeName: string;
  toNodeId: string;
  toNodeName: string;
  edgeId: string;
  edgeName: string;
  distanceMeters: number;
  cumulativeDistanceMeters: number;
  stepFreeStatus: 'YES' | 'NO' | 'UNKNOWN';
  hasSteps: boolean;
  warnings: string[];
}

export interface RoutePlanResult {
  status: 'OK' | 'NO_ROUTE';
  profile: ProfileType;
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
  route: {
    nodeIds: string[];
    edgeIds: string[];
    distanceMeters: number;
    baselineDistanceMeters: number;
    distanceDifferenceMeters: number;
    itinerary: RouteStep[];
  } | null;
  baselineNodeIds: string[];
  baselineEdgeIds: string[];
  baselineDistanceMeters: number | null;
  excludedEdges: Record<string, string>;
  warnings: string[];
  explanation: string;
}

interface AdjacencyEdge {
  edgeId: string;
  fromNode: string;
  toNode: string;
  targetNode: string;
  lengthM: number;
  stepFreeStatus: 'YES' | 'NO' | 'UNKNOWN';
  hasSteps: boolean;
  name: string;
}

export function buildAdjacencyList(
  edges: EdgeRecord[]
): Map<string, AdjacencyEdge[]> {
  const adj = new Map<string, AdjacencyEdge[]>();

  for (const edge of edges) {
    if (!adj.has(edge.from_node)) adj.set(edge.from_node, []);
    if (!adj.has(edge.to_node)) adj.set(edge.to_node, []);

    // Undirected graph: add both directions
    adj.get(edge.from_node)!.push({
      edgeId: edge.id,
      fromNode: edge.from_node,
      toNode: edge.to_node,
      targetNode: edge.to_node,
      lengthM: edge.length_m,
      stepFreeStatus: edge.step_free_status,
      hasSteps: edge.has_steps,
      name: edge.name,
    });

    adj.get(edge.to_node)!.push({
      edgeId: edge.id,
      fromNode: edge.to_node,
      toNode: edge.from_node,
      targetNode: edge.from_node,
      lengthM: edge.length_m,
      stepFreeStatus: edge.step_free_status,
      hasSteps: edge.has_steps,
      name: edge.name,
    });
  }

  // Sort edges by edgeId for stable tie-breaking
  for (const [_, list] of adj.entries()) {
    list.sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  }

  return adj;
}

interface DijkstraPath {
  nodeIds: string[];
  edgeIds: string[];
  totalDistance: number;
  edgesUsed: AdjacencyEdge[];
}

export function runDijkstra(
  originId: string,
  destinationId: string,
  adj: Map<string, AdjacencyEdge[]>,
  isEdgeAllowed: (edge: AdjacencyEdge) => boolean
): DijkstraPath | null {
  if (originId === destinationId) {
    return {
      nodeIds: [originId],
      edgeIds: [],
      totalDistance: 0,
      edgesUsed: [],
    };
  }

  const dist = new Map<string, number>();
  const prevNode = new Map<string, string>();
  const prevEdge = new Map<string, AdjacencyEdge>();
  const visited = new Set<string>();

  dist.set(originId, 0);

  // Simple stable priority queue
  const queue: string[] = [originId];

  while (queue.length > 0) {
    // Sort queue by dist ascending, then node ID for stable tie-breaking
    queue.sort((a, b) => {
      const dA = dist.get(a) ?? Infinity;
      const dB = dist.get(b) ?? Infinity;
      if (dA !== dB) return dA - dB;
      return a.localeCompare(b);
    });

    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (current === destinationId) break;

    const currentDist = dist.get(current)!;
    const neighbors = adj.get(current) || [];

    for (const edge of neighbors) {
      if (!isEdgeAllowed(edge)) continue;
      const nextNode = edge.targetNode;
      if (visited.has(nextNode)) continue;

      const newDist = currentDist + edge.lengthM;
      const existingDist = dist.get(nextNode) ?? Infinity;

      if (newDist < existingDist) {
        dist.set(nextNode, newDist);
        prevNode.set(nextNode, current);
        prevEdge.set(nextNode, edge);
        if (!queue.includes(nextNode)) {
          queue.push(nextNode);
        }
      }
    }
  }

  if (!dist.has(destinationId) || dist.get(destinationId) === Infinity) {
    return null;
  }

  // Backtrack path
  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  const edgesUsed: AdjacencyEdge[] = [];

  let curr = destinationId;
  nodeIds.push(curr);

  while (curr !== originId) {
    const edge = prevEdge.get(curr);
    const prev = prevNode.get(curr);
    if (!edge || !prev) return null;

    edgeIds.unshift(edge.edgeId);
    edgesUsed.unshift(edge);
    curr = prev;
    nodeIds.unshift(curr);
  }

  return {
    nodeIds,
    edgeIds,
    totalDistance: dist.get(destinationId)!,
    edgesUsed,
  };
}

export function planRoute(
  originId: string,
  destinationId: string,
  profile: ProfileType,
  nodes: NodeRecord[],
  edges: EdgeRecord[],
  incidents: IncidentRecord[],
  reportsMap: Map<string, ReportRecord[]>
): RoutePlanResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const originNode = nodeMap.get(originId);
  const destNode = nodeMap.get(destinationId);

  if (!originNode || !destNode) {
    throw new Error('Invalid origin or destination node ID');
  }

  const adj = buildAdjacencyList(edges);
  const activeIncidentsByEdge = new Map<string, IncidentRecord>();

  for (const inc of incidents) {
    if (inc.status !== 'CLEARED' && !inc.dismissed_at) {
      activeIncidentsByEdge.set(inc.edge_id, inc);
    }
  }

  // 1. Calculate baseline route (ignoring temporary incidents, but enforcing profile constraints)
  const baselineIsAllowed = (e: AdjacencyEdge) => {
    if (profile === 'STEP_FREE') {
      return e.stepFreeStatus === 'YES' && !e.hasSteps;
    }
    return true; // GENERAL_WALK allows stairs and unknown links
  };

  const baseline = runDijkstra(originId, destinationId, adj, baselineIsAllowed);

  // 2. Determine edge exclusions for current route
  const excludedEdges: Record<string, string> = {};
  const warnings: string[] = [];

  const currentIsAllowed = (e: AdjacencyEdge): boolean => {
    // Check static profile constraints
    if (profile === 'STEP_FREE') {
      if (e.hasSteps) {
        excludedEdges[e.edgeId] = 'Segment has steps (incompatible with step-free preference)';
        return false;
      }
      if (e.stepFreeStatus !== 'YES') {
        excludedEdges[e.edgeId] = 'Step-free status is UNKNOWN/unverified (excluded for step-free preference)';
        return false;
      }
    }

    // Check active incidents
    const inc = activeIncidentsByEdge.get(e.edgeId);
    if (inc) {
      if (inc.status === 'CONFIRMED_BLOCKED') {
        if (profile === 'GENERAL_WALK' && inc.blocked_general) {
          excludedEdges[e.edgeId] = 'Confirmed blocked for general walking';
          return false;
        }
        if (profile === 'STEP_FREE' && inc.blocked_step_free) {
          excludedEdges[e.edgeId] = 'Confirmed blocked for step-free access';
          return false;
        }
      }

      // Precautionary avoidance for STEP_FREE on UNVERIFIED active incident with usable completed analysis showing possible obstruction
      if (profile === 'STEP_FREE' && inc.status === 'UNVERIFIED') {
        const edgeReports = reportsMap.get(inc.id) || [];
        const hasCompletedObstruction = edgeReports.some((r) => {
          if (r.excluded_from_quorum || r.analysis_status !== 'COMPLETE' || !r.analysis_json) {
            return false;
          }
          const pass = r.analysis_json.passability.step_free;
          return pass === 'BLOCKED' || pass === 'UNCERTAIN' || pass === 'UNKNOWN';
        });

        if (hasCompletedObstruction) {
          excludedEdges[e.edgeId] = 'Precautionary avoidance of an unverified obstruction';
          return false;
        }
      }
    }

    return true;
  };

  const currentRoute = runDijkstra(originId, destinationId, adj, currentIsAllowed);

  // Check warnings for baseline links that were affected or avoided
  if (baseline) {
    for (const edgeId of baseline.edgeIds) {
      const inc = activeIncidentsByEdge.get(edgeId);
      if (inc) {
        if (excludedEdges[edgeId]) {
          warnings.push(`Baseline segment ${edgeId} (${inc.edge_name || edgeId}) is avoided: ${excludedEdges[edgeId]}`);
        } else if (inc.status === 'UNVERIFIED') {
          warnings.push(`Unverified community report on segment ${edgeId} (${inc.edge_name || edgeId}) — exercise caution.`);
        }
      }
    }
  }

  if (!currentRoute) {
    const noRouteMsg =
      profile === 'STEP_FREE'
        ? 'No step-free route available in this demo network; contact local assistance.'
        : 'No pedestrian route available between the selected points due to active obstructions.';

    return {
      status: 'NO_ROUTE',
      profile,
      originId,
      originName: originNode.name,
      destinationId,
      destinationName: destNode.name,
      route: null,
      baselineNodeIds: baseline?.nodeIds || [],
      baselineEdgeIds: baseline?.edgeIds || [],
      baselineDistanceMeters: baseline?.totalDistance || null,
      excludedEdges,
      warnings,
      explanation: noRouteMsg,
    };
  }

  // Build step-by-step itinerary
  let cumulative = 0;
  const itinerary: RouteStep[] = currentRoute.edgesUsed.map((edge, index) => {
    cumulative += edge.lengthM;
    const stepWarnings: string[] = [];
    const inc = activeIncidentsByEdge.get(edge.edgeId);
    if (inc) {
      stepWarnings.push(`Caution: active report (${inc.status}) on this segment.`);
    }
    if (edge.hasSteps) {
      stepWarnings.push('Note: Segment contains stairs.');
    }

    const fromNode = nodeMap.get(edge.fromNode)!;
    const toNode = nodeMap.get(edge.targetNode)!;

    return {
      stepIndex: index + 1,
      fromNodeId: edge.fromNode,
      fromNodeName: fromNode.name,
      toNodeId: edge.targetNode,
      toNodeName: toNode.name,
      edgeId: edge.edgeId,
      edgeName: edge.name,
      distanceMeters: edge.lengthM,
      cumulativeDistanceMeters: cumulative,
      stepFreeStatus: edge.stepFreeStatus,
      hasSteps: edge.hasSteps,
      warnings: stepWarnings,
    };
  });

  const baselineDist = baseline ? baseline.totalDistance : currentRoute.totalDistance;
  const diffMeters = currentRoute.totalDistance - baselineDist;

  let explanation = `Direct route of ${currentRoute.totalDistance}m along scheduled pathways.`;
  if (diffMeters > 0) {
    explanation = `Detour route of ${currentRoute.totalDistance}m (+${diffMeters}m compared to ${baselineDist}m baseline) navigating around active obstructions or non-step-free segments.`;
  } else if (diffMeters < 0) {
    explanation = `Selected path is ${currentRoute.totalDistance}m.`;
  }

  return {
    status: 'OK',
    profile,
    originId,
    originName: originNode.name,
    destinationId,
    destinationName: destNode.name,
    route: {
      nodeIds: currentRoute.nodeIds,
      edgeIds: currentRoute.edgeIds,
      distanceMeters: currentRoute.totalDistance,
      baselineDistanceMeters: baselineDist,
      distanceDifferenceMeters: diffMeters,
      itinerary,
    },
    baselineNodeIds: baseline?.nodeIds || [],
    baselineEdgeIds: baseline?.edgeIds || [],
    baselineDistanceMeters: baselineDist,
    excludedEdges,
    warnings,
    explanation,
  };
}
