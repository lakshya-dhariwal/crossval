import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getOwnedDocument } from "@/lib/services/documents";
import { DocumentEditor } from "@/components/editor/document-editor";
type Props = { params: Promise<{ id: string }> };
export default async function DocumentPage({ params }: Props) { const { id } = await params; const user = await requirePageUser(); let document; try { document = await getOwnedDocument(user.id, id); } catch { notFound(); } return <DocumentEditor initial={document!} />; }
