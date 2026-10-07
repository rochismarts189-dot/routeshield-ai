import { describe, it, expect } from 'vitest';
import { isQualifyingBlockReport, isQualifyingClearReport } from '../src/services/incidents.js';
import { ReportRecord } from '../repositories/reports.js';

describe('Incident Policy Rules', () => {
  const baseTime = new Date().toISOString();

  const validAnalysis = {
    obstruction_type: 'CONSTRUCTION_BARRIER' as const,
    severity: 'HIGH' as const,
    visible_extent: 'FULL_WIDTH' as const,
    passability: {
      general_walk: 'BLOCKED' as const,
      step_free: 'BLOCKED' as const,
    },
    evidence_quality: 'CLEAR' as const,
    description_consistency: 'SUPPORTS' as const,
    observations: ['Full height temporary fence completely blocking sidewalk'],
    confidence: 0.95,
    uncertainty_reasons: [],
  };

  it('qualifies a fresh, clear report with full width obstruction and blocked passability', () => {
    const report: ReportRecord = {
      id: 'r1',
      incident_id: 'inc1',
      reporter_id: 'user1',
      claim: 'BLOCKED',
      description: 'Barrier blocking the path',
      photo_key: 'photo1.jpg',
      photo_sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      content_type: 'image/jpeg',
      byte_count: 1024,
      latitude: 12.0,
      longitude: 77.0,
      location_mode: 'SEGMENT_SELECTION',
      observed_at: baseTime,
      received_at: baseTime,
      analysis_status: 'COMPLETE',
      analysis_model: 'gemini-2.5-flash',
      analysis_json: validAnalysis,
      analysis_error_code: null,
      analysis_attempts: 1,
      excluded_from_quorum: false,
      exclusion_note: null,
    };

    expect(isQualifyingBlockReport(report)).toBe(true);
  });

  it('rejects an excluded report from quorum eligibility', () => {
    const report: ReportRecord = {
      id: 'r1',
      incident_id: 'inc1',
      reporter_id: 'user1',
      claim: 'BLOCKED',
      description: 'Barrier blocking the path',
      photo_key: 'photo1.jpg',
      photo_sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      content_type: 'image/jpeg',
      byte_count: 1024,
      latitude: 12.0,
      longitude: 77.0,
      location_mode: 'SEGMENT_SELECTION',
      observed_at: baseTime,
      received_at: baseTime,
      analysis_status: 'COMPLETE',
      analysis_model: 'gemini-2.5-flash',
      analysis_json: validAnalysis,
      analysis_error_code: null,
      analysis_attempts: 1,
      excluded_from_quorum: true, // Marked excluded by moderator
      exclusion_note: 'Suspicious stock photo',
    };

    expect(isQualifyingBlockReport(report)).toBe(false);
  });

  it('rejects a report older than 30 minutes from automated confirmation quorum', () => {
    const oldTime = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // 45 min ago
    const report: ReportRecord = {
      id: 'r1',
      incident_id: 'inc1',
      reporter_id: 'user1',
      claim: 'BLOCKED',
      description: 'Old report',
      photo_key: 'photo1.jpg',
      photo_sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      content_type: 'image/jpeg',
      byte_count: 1024,
      latitude: 12.0,
      longitude: 77.0,
      location_mode: 'SEGMENT_SELECTION',
      observed_at: oldTime,
      received_at: baseTime,
      analysis_status: 'COMPLETE',
      analysis_model: 'gemini-2.5-flash',
      analysis_json: validAnalysis,
      analysis_error_code: null,
      analysis_attempts: 1,
      excluded_from_quorum: false,
      exclusion_note: null,
    };

    expect(isQualifyingBlockReport(report)).toBe(false);
  });

  it('detects qualifying clear evidence correctly', () => {
    const clearAnalysis = {
      obstruction_type: 'NONE' as const,
      severity: 'LOW' as const,
      visible_extent: 'NONE' as const,
      passability: {
        general_walk: 'APPEARS_CLEAR' as const,
        step_free: 'APPEARS_CLEAR' as const,
      },
      evidence_quality: 'CLEAR' as const,
      description_consistency: 'SUPPORTS' as const,
      observations: ['Walkway is completely clear and open with no visible obstruction'],
      confidence: 0.98,
      uncertainty_reasons: [],
    };

    const clearReport: ReportRecord = {
      id: 'r2',
      incident_id: 'inc1',
      reporter_id: 'user2',
      claim: 'CLEAR',
      description: 'Barriers removed, path is open',
      photo_key: 'photo2.jpg',
      photo_sha256: '9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef',
      content_type: 'image/jpeg',
      byte_count: 1024,
      latitude: 12.0,
      longitude: 77.0,
      location_mode: 'SEGMENT_SELECTION',
      observed_at: baseTime,
      received_at: baseTime,
      analysis_status: 'COMPLETE',
      analysis_model: 'gemini-2.5-flash',
      analysis_json: clearAnalysis,
      analysis_error_code: null,
      analysis_attempts: 1,
      excluded_from_quorum: false,
      exclusion_note: null,
    };

    expect(isQualifyingClearReport(clearReport)).toBe(true);
  });
});
