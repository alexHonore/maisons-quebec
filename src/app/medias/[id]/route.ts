import { mediaDirectory, readPublicMediaFile } from "@/server/media-library";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const file = readPublicMediaFile(settingsDatabase(process.env), id, mediaDirectory(process.env));
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.contentType,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
