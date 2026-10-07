import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { resolveApiBaseUrl, api } from '../lib/api';
import { toLocalDateTimeInput } from '../lib/time';
import { PlannerPage } from '../pages/PlannerPage';
import { VerificationPanel } from '../components/VerificationPanel';
import { NetworkMap } from '../components/NetworkMap';
import type { IncidentDetail, Node, Edge, RoutePlan } from '../types';
const nodes: Node[] = ['A','B','C','D'].map((id, i) => ({ id, name: `Landmark ${id}`, latitude: 12, longitude: 77, map_x: 40+i*100, map_y: 180 }));
const edges: Edge[] = [{ id: 'BC', from_node: 'B', to_node: 'C', name: 'Library walk', length_m: 160, step_free_status: 'YES', has_steps: false }];
beforeEach(() => vi.restoreAllMocks());
describe('Deployment URL and timestamps', () => {
  it('uses the Vite proxy locally and requires a real HTTPS backend in production', () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe('');
    expect(() => resolveApiBaseUrl(undefined, true)).toThrow('VITE_API_BASE_URL');
    expect(() => resolveApiBaseUrl('http://localhost:5001', true)).toThrow('HTTPS');
    expect(resolveApiBaseUrl('https://routeshield.onrender.com/api/', true)).toBe('https://routeshield.onrender.com');
  });
  it('represents the observation time in the local time zone', () => {
    const date = new Date(); date.setSeconds(0, 0);
    expect(new Date(toLocalDateTimeInput(date)).getTime()).toBe(date.getTime());
  });
});
describe('Accessible workflow screens', () => {
  const routeResult = (distance: number): RoutePlan => ({ status: 'OK', profile: 'STEP_FREE', originId: 'A', destinationId: 'D', originName: 'Landmark A', destinationName: 'Landmark D', baselineDistanceMeters: 460,
    baselineNodeIds: ['A', 'D'], baselineEdgeIds: ['BC'], excludedEdges: {}, warnings: [], explanation: `Route is ${distance} meters.`,
    route: { nodeIds: ['A', 'D'], edgeIds: ['BC'], distanceMeters: distance, baselineDistanceMeters: 460, distanceDifferenceMeters: distance - 460, itinerary: [] } });
  it('reloads the network after a connection failure', async () => {
    vi.spyOn(api, 'getNetwork').mockRejectedValueOnce(new Error('Backend asleep')).mockResolvedValue({ nodes, edges });
    vi.spyOn(api, 'getIncidents').mockResolvedValue({ incidents: [] });
    vi.spyOn(api, 'planRoute').mockRejectedValue(new Error('test route unavailable'));
    render(<MemoryRouter><PlannerPage /></MemoryRouter>);
    await screen.findByText('Backend asleep');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.getNetwork).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByRole('option', { name: 'A: Landmark A' })).toHaveLength(2);
  });
  it('does not create inactive keyboard buttons for a static map', () => {
    render(<NetworkMap nodes={nodes} edges={edges} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
  it('clears the previous journey when the origin and destination become identical', async () => {
    vi.spyOn(api, 'getNetwork').mockResolvedValue({ nodes, edges });
    vi.spyOn(api, 'getIncidents').mockResolvedValue({ incidents: [] });
    vi.spyOn(api, 'planRoute').mockResolvedValue(routeResult(460));
    render(<MemoryRouter><PlannerPage /></MemoryRouter>);
    await screen.findByText('Route is 460 meters.');
    fireEvent.change(screen.getByLabelText('Destination Stop / Landmark'), { target: { value: 'A' } });
    await screen.findByText('Origin and destination must be different points.');
    expect(screen.queryByText('Route is 460 meters.')).not.toBeInTheDocument();
  });
  it('recalculates on refresh even when the landmarks remain the same, and removes stale data on failure', async () => {
    const network = vi.spyOn(api, 'getNetwork').mockResolvedValue({ nodes, edges });
    vi.spyOn(api, 'getIncidents').mockResolvedValue({ incidents: [] });
    vi.spyOn(api, 'planRoute').mockResolvedValueOnce(routeResult(460)).mockResolvedValue(routeResult(740));
    render(<MemoryRouter><PlannerPage /></MemoryRouter>);
    await screen.findByText('Route is 460 meters.');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh incidents and route' }));
    await screen.findByText('Route is 740 meters.');
    network.mockRejectedValueOnce(new Error('Backend asleep'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh incidents and route' }));
    await screen.findByText('Route data isn’t available yet');
    expect(screen.queryByText('Route is 740 meters.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Origin Stop / Landmark')).toBeDisabled();
  });
  it('submits the selected evidence ID for moderator verification', async () => {
    const verify = vi.spyOn(api, 'verifyIncident').mockResolvedValue({ message: 'done', incident: {} });
    const incident = { id: 'test', status: 'UNVERIFIED', version: 3, reports: [{ id: 'evidence', reporterName: 'Alice', claim: 'BLOCKED', observedAt: new Date().toISOString(), analysisStatus: 'COMPLETE', excludedFromQuorum: false }] } as IncidentDetail;
    render(<VerificationPanel incident={incident} onVerified={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Evidence supporting this action'), { target: { value: 'evidence' } });
    fireEvent.change(screen.getByLabelText('Moderation Reason & Audit Note'), { target: { value: 'Whole segment reviewed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Verification Action' }));
    await waitFor(() => expect(verify).toHaveBeenCalledWith('test', expect.objectContaining({ evidenceReportId: 'evidence', expectedVersion: 3 })));
  });
});
