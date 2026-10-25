import { NextResponse } from "next/server";
import { ApiError, handle, rateLimit } from "@/server/http";
import { processFrame } from "@/server/pipeline";
import { getMeeting } from "@/server/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "frames", 30);
  const { id } = await ctx.params;
  await getMeeting(id);
  const form = await req.formData();
  const image = form.get("image");
  if (!(image instanceof File)) throw new ApiError(400, "no_image", "Missing image field");
  if (!ALLOWED.includes(image.type)) throw new ApiError(400, "bad_type", "Image must be JPEG, PNG or WebP");
  if (image.size > 12 * 1024 * 1024) throw new ApiError(413, "too_large", "Image over 12 MB");
  const sharedBy = (form.get("sharedBy") as string | null)?.slice(0, 120) || null;
  const result = await processFrame({
    meetingId: id,
    buffer: Buffer.from(await image.arrayBuffer()),
    mimeType: image.type,
    sharedBy,
  });
  return NextResponse.json(result, { status: 201 });
});
