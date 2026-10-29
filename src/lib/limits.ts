/** Usage limits per account. The exempt account has none. Enforced on the server; the client only mirrors the meeting timer. */
export const EXEMPT_EMAIL = "anilkumarkondeboina@gmail.com";
export const MAX_PROJECTS = 1;
export const MAX_MEETINGS = 1;
export const MAX_MEETING_MIN = 20;
export const MAX_MEETING_SEC = MAX_MEETING_MIN * 60;

export const isExempt = (email: string | null | undefined) => (email ?? "").trim().toLowerCase() === EXEMPT_EMAIL;
