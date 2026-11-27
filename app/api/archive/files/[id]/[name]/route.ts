import { NextRequest, NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "node:stream";
import { getDatabase } from "@/lib/database";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { validArchivePreview } from "@/lib/archive-preview-token";
import type { ArchiveItem } from "@/lib/archive";

export const runtime = "nodejs";
const mime: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet", odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf", txt: "text/plain; charset=utf-8", csv: "text/plain; charset=utf-8", json: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
};
async function serve(request: NextRequest, context: { params: Promise<{ id: string; name: string }> }, head: boolean) {
  const { id } = await context.params;
  if (!/^[a-f0-9]{24}$/.test(id)) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  const signed = validArchivePreview(id, request.nextUrl.searchParams.get("expires"), request.nextUrl.searchParams.get("token"));
  if (!signed && !verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.json({ error: "Войди в приложение" }, { status: 401 });
  try {
    const db = await getDatabase();
    const item = await db.collection<ArchiveItem>("archive").findOne({ kind: "file", "file.id": id });
    if (!item?.file || !await db.collection("archive_files.files").findOne({ _id: new ObjectId(id) })) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    const attachment = request.nextUrl.searchParams.get("download") === "1" || !mime[item.file.extension];
    const stream = head ? null : Readable.toWeb(new GridFSBucket(db, { bucketName: "archive_files" }).openDownloadStream(new ObjectId(id))) as ReadableStream<Uint8Array>;
    return new NextResponse(stream, { headers: {
      "Content-Type": mime[item.file.extension] ?? "application/octet-stream",
      "Content-Length": String(item.file.size),
      "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="archive.${item.file.extension}"; filename*=UTF-8''${encodeURIComponent(item.file.name)}`,
      "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'",
    } });
  } catch (error) {
    console.error("Failed to read archive file", error);
    return NextResponse.json({ error: "Не удалось открыть файл" }, { status: 500 });
  }
}
export async function GET(request: NextRequest, context: { params: Promise<{ id: string; name: string }> }) { return serve(request, context, false); }
export async function HEAD(request: NextRequest, context: { params: Promise<{ id: string; name: string }> }) { return serve(request, context, true); }
