import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/config/env.js', () => ({ env: { GOOGLE_MAPS_SERVER_API_KEY: 'isolated-test-key' } }));
import { computeWalkingRoutes, checkRealRoutes, realRouteInput, type GoogleRoute, type RealObstruction } from '../src/navigation/google.js';
import { decodePolyline, distanceToPathMeters } from '../src/navigation/geometry.js';
const original: GoogleRoute = { distanceMeters: 400, durationSeconds: 240, coordinates: [{lat:17.7,lng:83.3},{lat:17.7,lng:83.31}], encodedPolyline: 'isolated-fixture', labels: ['DEFAULT_ROUTE'], instructions: [], warnings: [] };
const alternative: GoogleRoute = { ...original, distanceMeters: 650, labels: ['DEFAULT_ROUTE_ALTERNATE'], coordinates: [{lat:17.7,lng:83.3},{lat:17.701,lng:83.3},{lat:17.701,lng:83.31},{lat:17.7,lng:83.31}] };
const obstruction: RealObstruction = { id:'real-incident',label:'Footpath',lat:17.7,lng:83.305,status:'CONFIRMED_BLOCKED',blockedGeneral:true,lastEvidenceAt:new Date().toISOString() };
afterEach(() => vi.unstubAllGlobals());
describe('Real Google navigation boundary', () => {
  it('decodes real polyline format and rejects corrupt or oversized geometry', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([{lat:38.5,lng:-120.2},{lat:40.7,lng:-120.95},{lat:43.252,lng:-126.453}]);
    expect(() => decodePolyline('~')).toThrow('INVALID_POLYLINE');
    expect(() => decodePolyline('??')).toThrow('INVALID_POLYLINE');
    expect(distanceToPathMeters(obstruction, original.coordinates)).toBeLessThan(1);
    expect(distanceToPathMeters(obstruction, alternative.coordinates)).toBeGreaterThan(100);
  });
  it('selects an actual returned alternative and never invents a detour', () => {
    const result = checkRealRoutes([original, alternative], [obstruction]);
    expect(result.status).toBe('ALTERNATIVE'); expect(result.recommended?.distanceMeters).toBe(650); expect(result.baseline?.distanceMeters).toBe(400);
    const blocked = checkRealRoutes([original], [obstruction]);
    expect(blocked.status).toBe('NO_VERIFIED_ALTERNATIVE'); expect(blocked.recommended).toBeNull(); expect(blocked.baseline).not.toBeNull();
    expect(checkRealRoutes([], []).status).toBe('NO_PROVIDER_ROUTE');
  });
  it('warns without treating unverified or step-free-only blocks as walking closures', () => {
    const report = checkRealRoutes([original], [{...obstruction,status:'UNVERIFIED',blockedGeneral:false}]);
    expect(report.status).toBe('OK'); expect(report.recommended?.nearbyIncidents).toHaveLength(1);
    expect(report.recommended?.avoided).toBe(false);
    expect(checkRealRoutes([original], [{...obstruction,blockedGeneral:false}]).status).toBe('OK');
    expect(checkRealRoutes([original], []).explanation).toContain('does not establish');
  });
  it('uses backend credentials in a fixed provider request and validates actual geometry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({routes:[{distanceMeters:42,duration:'30s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'},warnings:['Walking access warning']}]}), {status:200}));
    vi.stubGlobal('fetch', fetchMock);
    const result = await computeWalkingRoutes('public-origin','public-destination'); expect(result[0].distanceMeters).toBe(42);
    const [url, request] = fetchMock.mock.calls[0]; expect(url).toBe('https://routes.googleapis.com/directions/v2:computeRoutes');
    expect(request.headers['X-Goog-Api-Key']).toBe('isolated-test-key'); expect(JSON.parse(request.body).travelMode).toBe('WALK');
    expect(JSON.parse(request.body).computeAlternativeRoutes).toBe(true); expect(JSON.parse(request.body).routeModifiers).toBeUndefined();
    expect(result[0].warnings).toContain('Walking access warning');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({routes:[{distanceMeters:42,duration:'30s',polyline:{encodedPolyline:'broken'}}]}),{status:200}));
    await expect(computeWalkingRoutes('origin','destination')).rejects.toMatchObject({code:'INVALID_GOOGLE_ROUTE'});
  });
  it('does not leak provider errors or accept proxy URLs and invented provider results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive-provider-detail', {status:403})));
    await expect(computeWalkingRoutes('origin','destination')).rejects.toMatchObject({code:'GOOGLE_ROUTES_REJECTED'});
    expect(realRouteInput.safeParse({origin:'Visakhapatnam',destination:'Museum',providerUrl:'https://attacker.invalid'}).success).toBe(false);
  });
});
