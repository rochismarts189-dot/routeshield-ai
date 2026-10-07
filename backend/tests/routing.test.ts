import { describe, it, expect } from 'vitest';
import { planRoute } from '../src/services/routing.js';
import { NodeRecord, EdgeRecord } from '../repositories/network.js';
import { IncidentRecord } from '../repositories/incidents.js';
import { ReportRecord } from '../repositories/reports.js';

const DEMO_NODES: NodeRecord[] = [
  { id: 'A', name: 'Transit Stop', latitude: 12.0, longitude: 77.0, map_x: 40, map_y: 180 },
  { id: 'B', name: 'Market Corner', latitude: 12.0, longitude: 77.0013, map_x: 180, map_y: 180 },
  { id: 'C', name: 'Library Junction', latitude: 12.0, longitude: 77.0028, map_x: 340, map_y: 180 },
  { id: 'D', name: 'Clinic Entrance', latitude: 12.0, longitude: 77.0043, map_x: 500, map_y: 180 },
  { id: 'E', name: 'Garden Gate', latitude: 12.0011, longitude: 77.0013, map_x: 180, map_y: 60 },
  { id: 'F', name: 'Community Centre', latitude: 12.0011, longitude: 77.0028, map_x: 340, map_y: 60 },
  { id: 'G', name: 'South Crossing', latitude: 11.9987, longitude: 77.0013, map_x: 180, map_y: 320 },
  { id: 'H', name: 'Clinic Ramp', latitude: 11.9987, longitude: 77.0043, map_x: 500, map_y: 320 },
];

const DEMO_EDGES: EdgeRecord[] = [
  { id: 'AB', from_node: 'A', to_node: 'B', name: 'A-B', length_m: 140, step_free_status: 'YES', has_steps: false },
  { id: 'BC', from_node: 'B', to_node: 'C', name: 'B-C', length_m: 160, step_free_status: 'YES', has_steps: false },
  { id: 'CD', from_node: 'C', to_node: 'D', name: 'C-D', length_m: 160, step_free_status: 'YES', has_steps: false },
  { id: 'BE', from_node: 'B', to_node: 'E', name: 'B-E', length_m: 120, step_free_status: 'YES', has_steps: false },
  { id: 'EF', from_node: 'E', to_node: 'F', name: 'E-F (Stairs)', length_m: 160, step_free_status: 'NO', has_steps: true },
  { id: 'FD', from_node: 'D', to_node: 'F', name: 'D-F', length_m: 200, step_free_status: 'YES', has_steps: false },
  { id: 'BG', from_node: 'B', to_node: 'G', name: 'B-G', length_m: 140, step_free_status: 'YES', has_steps: false },
  { id: 'GH', from_node: 'G', to_node: 'H', name: 'G-H', length_m: 320, step_free_status: 'YES', has_steps: false },
  { id: 'HD', from_node: 'D', to_node: 'H', name: 'D-H', length_m: 140, step_free_status: 'YES', has_steps: false },
  { id: 'FC', from_node: 'C', to_node: 'F', name: 'C-F', length_m: 120, step_free_status: 'UNKNOWN', has_steps: false },
];

describe('Deterministic Routing Engine', () => {
  const emptyReports = new Map<string, ReportRecord[]>();

  it('calculates 460m baseline for both GENERAL_WALK and STEP_FREE (A->D via A-B-C-D)', () => {
    const generalPlan = planRoute('A', 'D', 'GENERAL_WALK', DEMO_NODES, DEMO_EDGES, [], emptyReports);
    expect(generalPlan.status).toBe('OK');
    expect(generalPlan.route?.distanceMeters).toBe(460);
    expect(generalPlan.route?.nodeIds).toEqual(['A', 'B', 'C', 'D']);
    expect(generalPlan.route?.edgeIds).toEqual(['AB', 'BC', 'CD']);

    const stepFreePlan = planRoute('A', 'D', 'STEP_FREE', DEMO_NODES, DEMO_EDGES, [], emptyReports);
    expect(stepFreePlan.status).toBe('OK');
    expect(stepFreePlan.route?.distanceMeters).toBe(460);
    expect(stepFreePlan.route?.nodeIds).toEqual(['A', 'B', 'C', 'D']);
  });

  it('calculates 620m detour for GENERAL_WALK when BC is confirmed blocked (uses stairs via E-F)', () => {
    const incidentBC: IncidentRecord = {
      id: 'inc-bc',
      edge_id: 'BC',
      created_by: 'user-1',
      status: 'CONFIRMED_BLOCKED',
      blocked_general: true,
      blocked_step_free: true,
      disputed: false,
      requires_review: false,
      version: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_evidence_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      cleared_at: null,
      dismissed_at: null,
      moderation_note: null,
    };

    const plan = planRoute('A', 'D', 'GENERAL_WALK', DEMO_NODES, DEMO_EDGES, [incidentBC], emptyReports);
    expect(plan.status).toBe('OK');
    expect(plan.route?.distanceMeters).toBe(620); // 140 (AB) + 120 (BE) + 160 (EF) + 200 (FD) = 620
    expect(plan.route?.nodeIds).toEqual(['A', 'B', 'E', 'F', 'D']);
    expect(plan.route?.edgeIds).toEqual(['AB', 'BE', 'EF', 'FD']);
    expect(plan.route?.distanceDifferenceMeters).toBe(160); // 620 - 460 = 160
  });

  it('calculates 740m step-free detour for STEP_FREE when BC is confirmed blocked (avoids stairs and unknown links, uses G-H)', () => {
    const incidentBC: IncidentRecord = {
      id: 'inc-bc',
      edge_id: 'BC',
      created_by: 'user-1',
      status: 'CONFIRMED_BLOCKED',
      blocked_general: true,
      blocked_step_free: true,
      disputed: false,
      requires_review: false,
      version: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_evidence_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      cleared_at: null,
      dismissed_at: null,
      moderation_note: null,
    };

    const plan = planRoute('A', 'D', 'STEP_FREE', DEMO_NODES, DEMO_EDGES, [incidentBC], emptyReports);
    expect(plan.status).toBe('OK');
    expect(plan.route?.distanceMeters).toBe(740); // 140 (AB) + 140 (BG) + 320 (GH) + 140 (HD) = 740
    expect(plan.route?.nodeIds).toEqual(['A', 'B', 'G', 'H', 'D']);
    expect(plan.route?.edgeIds).toEqual(['AB', 'BG', 'GH', 'HD']);
    expect(plan.route?.distanceDifferenceMeters).toBe(280); // 740 - 460 = 280
  });

  it('returns NO_ROUTE for STEP_FREE when both BC and GH are blocked (no accessible path exists)', () => {
    const incidentBC: IncidentRecord = {
      id: 'inc-bc',
      edge_id: 'BC',
      created_by: 'user-1',
      status: 'CONFIRMED_BLOCKED',
      blocked_general: true,
      blocked_step_free: true,
      disputed: false,
      requires_review: false,
      version: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_evidence_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      cleared_at: null,
      dismissed_at: null,
      moderation_note: null,
    };

    const incidentGH: IncidentRecord = {
      id: 'inc-gh',
      edge_id: 'GH',
      created_by: 'user-2',
      status: 'CONFIRMED_BLOCKED',
      blocked_general: false,
      blocked_step_free: true,
      disputed: false,
      requires_review: false,
      version: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_evidence_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      cleared_at: null,
      dismissed_at: null,
      moderation_note: null,
    };

    const plan = planRoute('A', 'D', 'STEP_FREE', DEMO_NODES, DEMO_EDGES, [incidentBC, incidentGH], emptyReports);
    expect(plan.status).toBe('NO_ROUTE');
    expect(plan.route).toBeNull();
    expect(plan.explanation).toContain('No step-free route available in this demo network; contact local assistance.');
  });

  it('restores 460m baseline after BC is cleared', () => {
    const clearedBC: IncidentRecord = {
      id: 'inc-bc',
      edge_id: 'BC',
      created_by: 'user-1',
      status: 'CLEARED',
      blocked_general: false,
      blocked_step_free: false,
      disputed: false,
      requires_review: false,
      version: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_evidence_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      cleared_at: new Date().toISOString(),
      dismissed_at: null,
      moderation_note: 'Cleared by moderator',
    };

    const plan = planRoute('A', 'D', 'STEP_FREE', DEMO_NODES, DEMO_EDGES, [clearedBC], emptyReports);
    expect(plan.status).toBe('OK');
    expect(plan.route?.distanceMeters).toBe(460);
    expect(plan.route?.nodeIds).toEqual(['A', 'B', 'C', 'D']);
  });
});
