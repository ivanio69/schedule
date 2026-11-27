import sharp from "sharp";
import { MAX_ARCHIVE_FILE_BYTES } from "@/lib/archive";

export class ArchiveCoverError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function prepareArchiveCover(file: File) {
  if (!file.size) throw new ArchiveCoverError("Выбери изображение афиши");
  if (file.size > MAX_ARCHIVE_FILE_BYTES) throw new ArchiveCoverError("Афиша должна быть не больше 4 МБ", 413);
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000, failOn: "error", autoOrient: true });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new ArchiveCoverError("Выбери статичную афишу в формате JPG, PNG, WebP или AVIF");
    const { data, info } = await image.resize({ width: 1600, height: 2263, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
    const stem = file.name.replace(/[\\/\r\n\x00-\x1f]/g, "_").replace(/\.[^.]*$/, "").trim().slice(0, 140) || "poster";
    return { bytes: data, name: `${stem}.webp`, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof ArchiveCoverError) throw error;
    throw new ArchiveCoverError("Не удалось прочитать афишу. Выбери другое изображение JPG, PNG, WebP или AVIF");
  }
}
