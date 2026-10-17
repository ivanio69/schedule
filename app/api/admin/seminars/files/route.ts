import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import { getDatabase } from "@/lib/database";
import type { SeminarAttachment, SeminarList } from "@/lib/seminars";

export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_COUNT = 20;
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "rtf", "odt", "odp", "ods", "jpg", "jpeg", "png", "webp", "gif", "mp3", "wav", "m4a", "mp4", "mov", "zip"]);
function authenticated(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update("schedule-admin").digest("hex");
  const actual = request.cookies.get("schedule_admin")?.value ?? "";
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
const unauthorized = () => NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });

export async function POST(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  try {
    const form = await request.formData();
    const listId = form.get("listId");
    const file = form.get("file");
    if (typeof listId !== "string" || !listId || !(file instanceof File)) {
      return NextResponse.json({ error: "Выбери семинар и файл" }, { status: 400 });
    }
    const name = file.name.replace(/[\\/\r\n\x00-\x1f]/g, "_").trim().slice(0, 160);
    const extension = name.split(".").pop()?.toLowerCase() ?? "";
    if (!name || !ALLOWED_EXTENSIONS.has(extension))
      return NextResponse.json({ error: "Этот формат файла не поддерживается" }, { status: 400 });
    if (!file.size || file.size > MAX_BYTES)
      return NextResponse.json({ error: "Размер файла должен быть не больше 10 МБ" }, { status: 413 });
    const db = await getDatabase();
    const lists = db.collection<SeminarList>("seminars");
    const list = await lists.findOne({ id: listId });
    if (!list) return NextResponse.json({ error: "Семинар не найден" }, { status: 404 });
    if ((list.files?.length ?? 0) >= MAX_COUNT)
      return NextResponse.json({ error: "Можно прикрепить не больше 20 файлов" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const id = new ObjectId();
    const bucket = new GridFSBucket(db, { bucketName: "seminar_attachments" });
    await new Promise<void>((resolve, reject) => {
      const stream = bucket.openUploadStreamWithId(id, name, { metadata: { listId, mimeType: file.type || "application/octet-stream" } });
      stream.once("error", reject);
      stream.once("finish", () => resolve());
      stream.end(bytes);
    });
    const attachment: SeminarAttachment = { id: id.toHexString(), name, size: bytes.length, mimeType: file.type || "application/octet-stream", createdAt: new Date().toISOString() };
    const result = await lists.updateOne({ id: listId, revision: list.revision }, {
      $set: { files: [...(list.files ?? []), attachment] },
      $inc: { revision: 1 },
    });
    if (!result.modifiedCount) {
      await bucket.delete(id).catch(() => {});
      return NextResponse.json({ error: "Семинар изменился. Обнови страницу и повтори загрузку" }, { status: 409 });
    }
    return NextResponse.json({ file: attachment }, { status: 201 });
  } catch (error) {
    console.error("Failed to upload seminar attachment", error);
    return NextResponse.json({ error: "Не удалось загрузить файл" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const listId = request.nextUrl.searchParams.get("listId") ?? "";
  const fileId = request.nextUrl.searchParams.get("fileId") ?? "";
  if (!listId || !/^[a-f\d]{24}$/i.test(fileId))
    return NextResponse.json({ error: "Не указан файл" }, { status: 400 });
  try {
    const db = await getDatabase();
    const lists = db.collection<SeminarList>("seminars");
    const list = await lists.findOne({ id: listId });
    if (!list) return NextResponse.json({ error: "Семинар не найден" }, { status: 404 });
    if (!list.files?.some(file => file.id === fileId))
      return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    const result = await lists.updateOne({ id: listId, revision: list.revision }, {
      $set: { files: list.files.filter(file => file.id !== fileId) }, $inc: { revision: 1 },
    });
    if (!result.modifiedCount)
      return NextResponse.json({ error: "Семинар изменился. Обнови страницу" }, { status: 409 });
    await new GridFSBucket(db, { bucketName: "seminar_attachments" }).delete(new ObjectId(fileId)).catch(error => console.error("Failed to clean seminar attachment", error));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete seminar attachment", error);
    return NextResponse.json({ error: "Не удалось удалить файл" }, { status: 500 });
  }
}
