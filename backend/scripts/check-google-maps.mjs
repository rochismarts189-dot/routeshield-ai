// Opt-in, single real Google Routes request. No database writes or fake routes.
// Run only after the account owner approves billing and configures the restricted key.
import 'dotenv/config';
import { z } from 'zod';

const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
const origin = process.env.GOOGLE_MAPS_CHECK_ORIGIN?.trim();
const destination = process.env.GOOGLE_MAPS_CHECK_DESTINATION?.trim();
if (!key || !origin || !destination) {
  console.error('Google Routes check not run: privately configure GOOGLE_MAPS_SERVER_API_KEY, GOOGLE_MAPS_CHECK_ORIGIN and GOOGLE_MAPS_CHECK_DESTINATION. See docs/google-maps-setup.md.');
  process.exit(1);
}

const routeSchema = z.object({
  routes: z.array(z.object({
    distanceMeters: z.number().nonnegative(),
    duration: z.string().regex(/^\d+(\.\d+)?s$/),
    polyline: z.object({ encodedPolyline: z.string().min(1) }),
    routeLabels: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
  })).min(1),
});

try {
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.routeLabels,routes.warnings',
    },
    body: JSON.stringify({
      origin: { address: origin }, destination: { address: destination },
      travelMode: 'WALK', computeAlternativeRoutes: true, polylineQuality: 'HIGH_QUALITY',
      languageCode: 'en-IN', regionCode: 'IN', units: 'METRIC',
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (!response.ok) {
    // Never log the request headers, API key, submitted addresses or full provider payload.
    const status = typeof body?.error?.status === 'string' ? body.error.status : 'PROVIDER_ERROR';
    console.error(`Google Routes check FAILED: HTTP ${response.status}, ${status}. Check project billing, Routes API enablement and server-key IP/API restrictions.`);
    process.exitCode = 1;
  } else {
    const parsed = routeSchema.safeParse(body);
    if (!parsed.success) {
      console.error('Google Routes check FAILED: no validated walking-route response. No route was invented.');
      process.exitCode = 1;
    } else {
      console.log(`PASS: real Google WALK request returned ${parsed.data.routes.length} validated route(s).`);
      console.log(JSON.stringify(parsed.data.routes.map(route => ({ distanceMeters: route.distanceMeters, duration: route.duration, labels: route.routeLabels ?? [], warnings: route.warnings ?? [] })), null, 2));
      console.log('Walking routes may omit sidewalks/pedestrian paths. This does not verify wheelchair/step-free access, incident matching or the complete RouteShield flow.');
    }
  }
} catch (error) {
  console.error(`Google Routes check FAILED: ${error instanceof Error && error.name === 'TimeoutError' ? 'provider timeout' : 'network or response error'}. No route was invented.`);
  process.exitCode = 1;
}
