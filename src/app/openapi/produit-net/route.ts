import { buildNetProceedsOpenApi } from "@/domain/openapi-produit-net";

export function GET() {
  return new Response(JSON.stringify(buildNetProceedsOpenApi()), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "x-robots-tag": "noindex",
    },
  });
}
