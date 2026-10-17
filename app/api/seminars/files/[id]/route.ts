import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { GridFSBucket, ObjectId } from "mongodb";
import { getDatabase } from "@/lib/database";
import type { SeminarList } from "@/lib/seminars";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f\d]{24}$/i.test(id))
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  try {
    const db = await getDatabase();
    const list = await db.collection<SeminarList>("seminars").findOne(
      { "files.id": id }, { projection: { files: 1 } }
    );
    const attachment = list?.files?.find(file => file.id === id);
    if (!attachment) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    const objectId = new ObjectId(id);
    const stored = await db.collection("seminar_attachments.files").findOne({ _id: objectId });
    if (!stored) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    const stream = new GridFSBucket(db, { bucketName: "seminar_attachments" }).openDownloadStream(objectId);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(attachment.size),
        "Content-Disposition": `attachment; filename="seminar-file"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to download seminar attachment", error);
    return NextResponse.json({ error: "Не удалось открыть файл" }, { status: 500 });
  }
}
