import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);

export async function parseBody<T extends ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "bad_json", "Request body must be JSON");
  }
  return schema.parse(raw);
}

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      }
      if (e instanceof ZodError) {
        const message = e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
        return NextResponse.json({ error: { code: "validation", message } }, { status: 400 });
      }
      console.error(e);
      return NextResponse.json({ error: { code: "internal", message: "Internal error" } }, { status: 500 });
    }
  };
}

const hits = new Map<string, number[]>();
export function rateLimit(req: Request, bucket: string, max = 120, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new ApiError(429, "rate_limited", "Too many requests");
  arr.push(now);
  hits.set(key, arr);
}
