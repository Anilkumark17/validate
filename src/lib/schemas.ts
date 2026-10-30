import { z } from "zod";

export const projectInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  targetUser: z.string().trim().max(300).optional().nullable(),
});

export const MAX_CONTEXT_CHARS = 20_000;
/** Title of the one context entry that the project form's Context textarea writes to. */
export const PROJECT_CONTEXT_TITLE = "Project context";

/** Create and edit form. context is optional plain text; empty removes the main context entry. */
export const projectForm = projectInput.extend({
  context: z.string().trim().max(MAX_CONTEXT_CHARS).optional(),
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

export const MAX_CONTEXT_ENTRIES = 50;

export const MAX_PERSONAS = 50;
export const personaInput = z.object({
  name: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(1000).default(""),
  jtbdSummary: z.string().trim().max(1000).default(""),
  mindsetSummary: z.string().trim().max(1000).default(""),
  segmentHints: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  systemPrompt: z.string().trim().max(8000).default(""),
});
export const personaPatch = z.object({ status: z.enum(["draft", "approved"]) });

/** Project context is plain text only while the feature is in testing. */
export const contextInput = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(MAX_CONTEXT_CHARS),
});
