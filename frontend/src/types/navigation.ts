import type { GeminiAnalysis } from './index';
export interface Coordinate { lat: number; lng: number }
export interface RealIncident extends Coordinate { id: string; label: string; status: 'UNVERIFIED' | 'CONFIRMED_BLOCKED' | 'CLEARED'; blockedGeneral: boolean; blockedStepFree: boolean; disputed: boolean; version: number; lastEvidenceAt: string }
export interface RealReport { id: string; reporterName: string; claim: string; description: string; observedAt: string; signedPhotoUrl: string | null; analysisStatus: string; analysisModel: string | null; analysisJson: GeminiAnalysis | null; analysisErrorCode: string | null; analysisAttempts: number }
export interface RealIncidentDetail extends RealIncident { dismissedAt: string | null; reports: RealReport[] }
export interface RealRoute { distanceMeters: number; durationSeconds: number; encodedPolyline: string; coordinates: Coordinate[]; instructions: string[]; warnings: string[]; nearbyIncidents: RealIncident[]; avoided: boolean }
export interface RealPlan { status: 'OK' | 'ALTERNATIVE' | 'NO_VERIFIED_ALTERNATIVE' | 'NO_PROVIDER_ROUTE'; baseline: RealRoute | null; recommended: RealRoute | null; candidateCount: number; explanation: string; accessibility: string; matching: string; checkedAt: string; activeIncidentCount: number }
export interface RealAnalysisResult { reportId: string; incidentId: string; incidentStatus: string; analysisStatus: string; model: string | null; analysis: GeminiAnalysis | null; errorCode: string | null }
