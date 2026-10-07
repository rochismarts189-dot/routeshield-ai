import { z } from 'zod';

export const createReportSchema = z.object({
  edgeId: z.string().regex(/^[A-Z]{2}$/, 'Select a known pedestrian segment.'),
  incidentId: z.string().uuid().optional(),
  claim: z.enum(['BLOCKED', 'CLEAR', 'UNCERTAIN'], {
    required_error: 'Claim (BLOCKED, CLEAR, or UNCERTAIN) is required',
  }),
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .default(''),
  observedAt: z
    .string()
    .datetime()
    .refine((val) => {
      const date = new Date(val);
      const now = new Date();
      // Observation must be within the last 24 hours
      const diffMs = now.getTime() - date.getTime();
      const pastLimit = 24 * 60 * 60 * 1000;
      // Not more than 5 minutes in the future (clock drift buffer)
      const futureLimit = -5 * 60 * 1000;
      return diffMs >= futureLimit && diffMs <= pastLimit;
    }, {
      message: 'Observed timestamp must be within the last 24 hours and not in the future',
    }),
}).strict();

export const retryAnalysisSchema = z.object({});

export const excludeReportSchema = z.object({
  reason: z.string().min(1, 'Reason for exclusion is required').max(1000),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
