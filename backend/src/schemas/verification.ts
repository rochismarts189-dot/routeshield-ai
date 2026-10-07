import { z } from 'zod';

export const verifyIncidentSchema = z.object({
  action: z.enum(['CONFIRM_BLOCKED', 'CLEAR', 'DISMISS']),
  evidenceReportId: z.string().uuid().optional(),
  blockedProfiles: z.array(z.enum(['GENERAL_WALK', 'STEP_FREE'])).optional(),
  expectedVersion: z.number().int().positive('expectedVersion must be a positive integer'),
  attestation: z.boolean().optional(),
  reason: z.string().min(1, 'Reason is required').max(1000),
}).strict().refine((data) => data.action === 'DISMISS' || !!data.evidenceReportId, {
  message: 'Select the evidence report supporting verification.', path: ['evidenceReportId'],
}).refine((data) => {
  if (data.action === 'CLEAR') {
    // CLEAR requires attestation that whole segment was checked
    return data.attestation === true;
  }
  return true;
}, {
  message: 'Clearing an incident requires explicit attestation that the whole segment was checked',
  path: ['attestation'],
}).refine((data) => {
  if (data.action === 'CONFIRM_BLOCKED') {
    // At least one blocked profile is required
    return data.blockedProfiles && data.blockedProfiles.length > 0;
  }
  return true;
}, {
  message: 'Confirming a block requires at least one blocked profile (GENERAL_WALK or STEP_FREE)',
  path: ['blockedProfiles'],
});

export type VerifyIncidentInput = z.infer<typeof verifyIncidentSchema>;
