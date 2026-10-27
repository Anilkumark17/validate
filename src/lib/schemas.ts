import { z } from "zod";

export const projectInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  targetUser: z.string().trim().max(300).optional().nullable(),
});

export const meetingInput = z.object({
  title: z.string().trim().min(1).max(160),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export const tokenInput = z.object({
  meetingId: z.string().uuid().optional(),
  inviteCode: z.string().min(4).optional(),
  name: z.string().trim().min(1).max(60),
});
