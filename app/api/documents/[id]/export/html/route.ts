import { withUser } from "@/app/api/_shared";
import { getOwnedFinalizedDocument } from "@/lib/services/documents";
import { htmlForDocument, safeFilename } from "@/lib/services/outputs";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return withUser(request, async (userId, db) => {
    const document = await getOwnedFinalizedDocument(userId, id, db);
    return new Response(htmlForDocument(document), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename(document.title)}.html"`,
      },
    });
  });
}
