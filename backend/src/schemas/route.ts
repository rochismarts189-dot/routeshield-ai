import { z } from 'zod';

export const planRouteSchema = z.object({
  originId: z.string().regex(/^[A-H]$/, 'Select a known origin.'),
  destinationId: z.string().regex(/^[A-H]$/, 'Select a known destination.'),
  profile: z.enum(['GENERAL_WALK', 'STEP_FREE'], {
    required_error: 'Routing profile is required (GENERAL_WALK or STEP_FREE)',
  }),
}).strict();

export type PlanRouteInput = z.infer<typeof planRouteSchema>;
