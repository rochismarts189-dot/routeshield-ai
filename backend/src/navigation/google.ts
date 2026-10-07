import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { decodePolyline, distanceToPathMeters, type Coordinate } from './geometry.js';

export const realRouteInput = z.object({ origin: z.string().trim().min(3).max(250), destination: z.string().trim().min(3).max(250) }).strict();
const responseSchema = z.object({ routes: z.array(z.object({
  distanceMeters: z.number().int().nonnegative(), duration: z.string().regex(/^\d+(\.\d+)?s$/),
  polyline: z.object({ encodedPolyline: z.string().min(1).max(200000) }),
  routeLabels: z.array(z.string()).optional(), warnings: z.array(z.string()).optional(),
  legs: z.array(z.object({ steps: z.array(z.object({
    distanceMeters: z.number().nonnegative().optional(),
    navigationInstruction: z.object({ instructions: z.string().max(2000).optional() }).optional(),
  })).optional() })).optional(),
})).max(5).default([]) });
export interface RealObstruction extends Coordinate { id: string; label: string; status: string; blockedGeneral: boolean; lastEvidenceAt: string }
export interface GoogleRoute { distanceMeters: number; durationSeconds: number; encodedPolyline: string; coordinates: Coordinate[]; instructions: string[]; warnings: string[]; labels: string[] }

export async function computeWalkingRoutes(origin: string, destination: string): Promise<GoogleRoute[]> {
  if (!env.GOOGLE_MAPS_SERVER_API_KEY) throw new AppError(503, 'GOOGLE_MAPS_NOT_CONFIGURED', 'Real navigation is not configured yet. The Maple Ward demo remains available.');
  let response: globalThis.Response;
  try {
    response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_MAPS_SERVER_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.routeLabels,routes.warnings,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters' },
      body: JSON.stringify({ origin: { address: origin }, destination: { address: destination }, travelMode: 'WALK',
        computeAlternativeRoutes: true, polylineQuality: 'HIGH_QUALITY', languageCode: 'en-IN', regionCode: 'IN', units: 'METRIC' }),
    });
  } catch { throw new AppError(502, 'GOOGLE_ROUTES_UNAVAILABLE', 'Google walking routes are temporarily unavailable. Try the Maple Ward demo.'); }
  if (!response.ok) {
    console.warn('[google routes] Provider request failed', { status: response.status });
    throw new AppError(response.status === 429 ? 429 : 502, 'GOOGLE_ROUTES_REJECTED', 'Google could not provide this walking route. Check the addresses or ask the operator to check API, billing and key restrictions.');
  }
  const parsed = responseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new AppError(502, 'INVALID_GOOGLE_ROUTE', 'Google returned an invalid route response. No route was invented.');
  try {
    return parsed.data.routes.map(route => ({ distanceMeters: route.distanceMeters, durationSeconds: parseFloat(route.duration),
      encodedPolyline: route.polyline.encodedPolyline, coordinates: decodePolyline(route.polyline.encodedPolyline),
      instructions: (route.legs ?? []).flatMap(leg => (leg.steps ?? []).flatMap(step => step.navigationInstruction?.instructions ? [step.navigationInstruction.instructions] : [])),
      warnings: route.warnings ?? [], labels: route.routeLabels ?? [] }));
  } catch { throw new AppError(502, 'INVALID_GOOGLE_ROUTE', 'Google returned invalid route geometry. No route was invented.'); }
}

export function checkRealRoutes(routes: GoogleRoute[], incidents: RealObstruction[]) {
  const checked = routes.map(route => {
    const nearby = incidents.filter(incident => distanceToPathMeters(incident, route.coordinates) <= 20);
    return { ...route, nearbyIncidents: nearby, avoided: nearby.some(i => i.status === 'CONFIRMED_BLOCKED' && i.blockedGeneral) };
  });
  const baseline = checked.find(route => route.labels.includes('DEFAULT_ROUTE')) ?? checked[0] ?? null;
  const recommended = baseline && !baseline.avoided ? baseline : checked.filter(route => !route.avoided).sort((a, b) => a.distanceMeters - b.distanceMeters)[0] ?? null;
  return { status: !baseline ? 'NO_PROVIDER_ROUTE' : !recommended ? 'NO_VERIFIED_ALTERNATIVE' : recommended === baseline ? 'OK' : 'ALTERNATIVE',
    baseline, recommended, candidateCount: checked.length,
    explanation: !baseline ? 'Google did not return a walking route for these addresses.' : !recommended
      ? 'Every walking route returned by Google passes near a confirmed obstruction. RouteShield cannot verify an alternative; no detour is invented.'
      : recommended !== baseline ? 'The original route passes within 20 m of a confirmed walking obstruction. This Google-provided alternative avoids those reported locations.'
      : baseline.nearbyIncidents.length ? 'There are community reports near this route. Unverified reports are warnings, not confirmed blocks.'
      : 'No active geolocated community incident was found within 20 m of this route. This does not establish that the route is clear.',
    accessibility: 'Google walking routes are not verified step-free or wheelchair-safe. Use Maple Ward for the controlled step-free demonstration.',
    matching: 'Approximate 20 m proximity check. A nearby report may concern a parallel path; photographs do not establish location. Community coverage is incomplete.' };
}
