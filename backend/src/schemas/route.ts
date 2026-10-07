import { z } from 'zod';

export const planRouteSchema = z.object({
  originId: z.string().min(1, 'Origin node ID is required'),
  destinationId: z.string().min(1, 'Destination node ID is required'),
  profile: z.enum(['GENERAL_WALK', 'STEP_FREE'], {
    required_error: 'Routing profile is required (GENERAL_WALK or STEP_FREE)',
  }),
});

export type PlanRouteInput = z.infer<typeof planRouteSchema>;
