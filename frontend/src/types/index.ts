export type RoutingProfile = 'GENERAL_WALK' | 'STEP_FREE';

export interface Node {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  map_x: number;
  map_y: number;
}

export interface Edge {
  id: string;
  from_node: string;
  to_node: string;
  name: string;
  length_m: number;
  step_free_status: 'YES' | 'NO' | 'UNKNOWN';
  has_steps: boolean;
}

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

export interface RoutePlan {
  status: 'OK' | 'NO_ROUTE';
  profile: RoutingProfile;
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

export interface GeminiAnalysis {
  obstruction_type: string;
  severity: string;
  visible_extent: string;
  passability: {
    general_walk: string;
    step_free: string;
  };
  evidence_quality: string;
  description_consistency: string;
  observations: string[];
  confidence: number;
  uncertainty_reasons: string[];
}

export interface ReportItem {
  id: string;
  reporterName: string;
  reporterId: string;
  claim: 'BLOCKED' | 'CLEAR' | 'UNCERTAIN';
  description: string;
  signedPhotoUrl: string | null;
  contentType: string;
  byteCount: number;
  latitude: number;
  longitude: number;
  observedAt: string;
  receivedAt: string;
  analysisStatus: 'PENDING' | 'COMPLETE' | 'FAILED';
  analysisModel: string | null;
  analysisJson: GeminiAnalysis | null;
  analysisErrorCode: string | null;
  analysisAttempts: number;
  excludedFromQuorum: boolean;
  exclusionNote: string | null;
}

export interface IncidentEvent {
  id: string;
  actorName: string;
  fromStatus: string | null;
  toStatus: string;
  reasonCode: string;
  metadata: any;
  createdAt: string;
}

export interface IncidentSummary {
  id: string;
  edgeId: string;
  edgeName: string;
  status: 'UNVERIFIED' | 'CONFIRMED_BLOCKED' | 'CLEARED';
  blockedGeneral: boolean;
  blockedStepFree: boolean;
  disputed: boolean;
  requiresReview: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastEvidenceAt: string;
  confirmedAt: string | null;
  clearedAt: string | null;
  dismissedAt: string | null;
  moderationNote: string | null;
  reportsCount: number;
  distinctAccountsCount: number;
}

export interface IncidentDetail extends IncidentSummary {
  confirmationBasis: string | null;
  reports: ReportItem[];
  events: IncidentEvent[];
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'MODERATOR';
  createdAt?: string;
}
