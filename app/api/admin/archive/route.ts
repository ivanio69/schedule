import { randomUUID } from "node:crypto";
import { GridFSBucket, ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { getRoleSessionPerson } from "@/lib/role-session";
import { ARCHIVE_EXTENSIONS, MAX_ARCHIVE_FILE_BYTES, archiveExtension, parseArchiveInput, type ArchiveFile, type ArchiveItem } from "@/lib/archive";

export const runtime = "nodejs";
class ArchiveError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
async function save(request: NextRequest, editing: boolean) {
  let uploaded: ObjectId | null = null;
  try {
    if (!await getRoleSessionPerson(request, ["admin"])) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    const form = await request.formData();
    const db = await getDatabase();
    const collection = db.collection<ArchiveItem>("archive");
    const bucket = new GridFSBucket(db, { bucketName: "archive_files" });
    const id = form.get("id");
    if (editing && (typeof id !== "string" || id.length > 100)) throw new ArchiveError("Материал не найден", 404);
    const current = editing ? await collection.findOne({ id: id as string }) : null;
    if (editing && !current) throw new ArchiveError("Материал не найден", 404);
    if (editing && !/^\d+$/.test(String(form.get("revision") ?? ""))) throw new ArchiveError("Некорректная версия материала");
    const revision = Number(form.get("revision"));
    if (current && (!Number.isInteger(revision) || current.revision !== revision)) throw new ArchiveError("Материал изменился. Обнови архив и открой редактирование заново", 409);
    const input = Object.fromEntries(["kind", "title", "discipline", "date", "url", "extension"].map(key => [key, form.get(key)]));
    if (current && input.kind !== current.kind) throw new ArchiveError("Раздел существующего материала менять нельзя");
    const source = form.get("source");
    if (input.kind === "file" && source !== "upload" && source !== "url") throw new ArchiveError("Выбери способ добавления файла");
    const candidate = form.get("file");
    const newFile = candidate instanceof File && candidate.size > 0 ? candidate : null;
    let file: ArchiveFile | null = input.kind === "file" && source === "upload" ? current?.file ?? null : null;
    if (input.kind === "file" && source === "upload" && !newFile && !file) throw new ArchiveError("Выбери файл для загрузки");
    const parsed = parseArchiveInput(input, Boolean(file || (newFile && source === "upload" && input.kind === "file")));
    if (newFile && source === "upload" && input.kind === "file") {
      const name = newFile.name.replace(/[\\/\r\n\x00-\x1f]/g, "_").trim().slice(0, 160);
      const extension = archiveExtension(name);
      if (!ARCHIVE_EXTENSIONS.includes(extension)) throw new ArchiveError("Этот формат не поддерживается");
      if (newFile.size > MAX_ARCHIVE_FILE_BYTES) throw new ArchiveError("Файл должен быть не больше 4 МБ. Для большого файла укажи прямую ссылку", 413);
      uploaded = new ObjectId();
      const bytes = Buffer.from(await newFile.arrayBuffer());
      const uploadId = uploaded;
      await new Promise<void>((resolve, reject) => {
        const stream = bucket.openUploadStreamWithId(uploadId, name);
        stream.once("error", reject);
        stream.once("finish", resolve);
        stream.end(bytes);
      });
      file = { id: uploaded.toHexString(), name, extension, size: bytes.length };
    }
    const now = new Date().toISOString();
    const item: ArchiveItem = { ...parsed, file, extension: file?.extension ?? parsed.extension, id: current?.id ?? randomUUID(), revision: (current?.revision ?? -1) + 1, createdAt: current?.createdAt ?? now, updatedAt: now };
    if (current) {
      const result = await collection.updateOne({ id: current.id, revision }, { $set: item });
      if (!result.matchedCount) throw new ArchiveError("Материал изменился. Обнови архив", 409);
    } else await collection.insertOne(item);
    uploaded = null; // The entry now owns this upload.
    if (current?.file && current.file.id !== file?.id) await bucket.delete(new ObjectId(current.file.id)).catch(error => console.error("Archive file cleanup failed", error));
    return NextResponse.json({ item }, { status: editing ? 200 : 201 });
  } catch (error) {
    if (uploaded) await getDatabase().then(db => new GridFSBucket(db, { bucketName: "archive_files" }).delete(uploaded!)).catch(cleanup => console.error("Archive upload cleanup failed", cleanup));
    if (error instanceof ArchiveError) return NextResponse.json({ error: error.message }, { status: error.status });
    // Input validation deliberately has user-facing messages.
    if (error instanceof Error && /^(Выбери|Укажи)/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Failed to save archive item", error);
    return NextResponse.json({ error: "Не удалось сохранить материал. Попробуй ещё раз" }, { status: 500 });
  }
}
export async function POST(request: NextRequest) { return save(request, false); }
export async function PATCH(request: NextRequest) { return save(request, true); }
export async function DELETE(request: NextRequest) {
  try {
    if (!await getRoleSessionPerson(request, ["admin"])) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    const id = request.nextUrl.searchParams.get("id");
    if (!/^\d+$/.test(request.nextUrl.searchParams.get("revision") ?? "")) throw new ArchiveError("Некорректная версия материала");
    const revision = Number(request.nextUrl.searchParams.get("revision"));
    if (!id || id.length > 100 || !Number.isInteger(revision)) throw new ArchiveError("Некорректный запрос");
    const db = await getDatabase();
    const item = await db.collection<ArchiveItem>("archive").findOneAndDelete({ id, revision });
    if (!item) throw new ArchiveError("Материал изменился или уже удалён. Обнови архив", 409);
    if (item.file) await new GridFSBucket(db, { bucketName: "archive_files" }).delete(new ObjectId(item.file.id)).catch(error => console.error("Archive file cleanup failed", error));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ArchiveError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to delete archive item", error);
    return NextResponse.json({ error: "Не удалось удалить материал" }, { status: 500 });
  }
}
