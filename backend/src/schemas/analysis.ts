import { z } from 'zod';

export const ObstructionTypeEnum = z.enum([
  'DEBRIS',
  'CONSTRUCTION_BARRIER',
  'PARKED_VEHICLE',
  'FLOODING',
  'FALLEN_OBJECT',
  'OTHER',
  'NONE',
  'UNKNOWN',
]);

export const SeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']);

export const VisibleExtentEnum = z.enum(['FULL_WIDTH', 'PARTIAL', 'NONE', 'UNCLEAR']);

export const GeneralWalkPassabilityEnum = z.enum([
  'BLOCKED',
  'PARTIAL',
  'APPEARS_CLEAR',
  'UNKNOWN',
]);

export const StepFreePassabilityEnum = z.enum([
  'BLOCKED',
  'UNCERTAIN',
  'APPEARS_CLEAR',
  'UNKNOWN',
]);

export const EvidenceQualityEnum = z.enum(['CLEAR', 'LIMITED', 'UNUSABLE']);

export const DescriptionConsistencyEnum = z.enum([
  'SUPPORTS',
  'CONFLICTS',
  'NO_DESCRIPTION',
  'UNCLEAR',
]);

export const geminiAnalysisSchema = z.object({
  obstruction_type: ObstructionTypeEnum,
  severity: SeverityEnum,
  visible_extent: VisibleExtentEnum,
  passability: z.object({
    general_walk: GeneralWalkPassabilityEnum,
    step_free: StepFreePassabilityEnum,
  }),
  evidence_quality: EvidenceQualityEnum,
  description_consistency: DescriptionConsistencyEnum,
  observations: z.array(z.string().min(1).max(200)).min(1).max(5),
  confidence: z.number().min(0).max(1),
  uncertainty_reasons: z.array(z.string().min(1).max(200)).min(0).max(5),
});

export type GeminiAnalysis = z.infer<typeof geminiAnalysisSchema>;

// Strict JSON Schema for Gemini structured output
export const geminiResponseJsonSchema = {
  type: 'object',
  properties: {
    obstruction_type: {
      type: 'string',
      enum: [
        'DEBRIS',
        'CONSTRUCTION_BARRIER',
        'PARKED_VEHICLE',
        'FLOODING',
        'FALLEN_OBJECT',
        'OTHER',
        'NONE',
        'UNKNOWN',
      ],
    },
    severity: {
      type: 'string',
      enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'],
    },
    visible_extent: {
      type: 'string',
      enum: ['FULL_WIDTH', 'PARTIAL', 'NONE', 'UNCLEAR'],
    },
    passability: {
      type: 'object',
      properties: {
        general_walk: {
          type: 'string',
          enum: ['BLOCKED', 'PARTIAL', 'APPEARS_CLEAR', 'UNKNOWN'],
        },
        step_free: {
          type: 'string',
          enum: ['BLOCKED', 'UNCERTAIN', 'APPEARS_CLEAR', 'UNKNOWN'],
        },
      },
      required: ['general_walk', 'step_free'],
    },
    evidence_quality: {
      type: 'string',
      enum: ['CLEAR', 'LIMITED', 'UNUSABLE'],
    },
    description_consistency: {
      type: 'string',
      enum: ['SUPPORTS', 'CONFLICTS', 'NO_DESCRIPTION', 'UNCLEAR'],
    },
    observations: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 5,
    },
    confidence: {
      type: 'number',
    },
    uncertainty_reasons: {
      type: 'array',
      items: { type: 'string' },
      minItems: 0,
      maxItems: 5,
    },
  },
  required: [
    'obstruction_type',
    'severity',
    'visible_extent',
    'passability',
    'evidence_quality',
    'description_consistency',
    'observations',
    'confidence',
    'uncertainty_reasons',
  ],
};
