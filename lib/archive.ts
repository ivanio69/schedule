export const ARCHIVE_SECTIONS = [
  { kind: "show", title: "Архив показов", description: "Работы, к которым хочется вернуться" },
  { kind: "file", title: "Архив полезных файлов", description: "Материалы для учёбы и творчества" },
  { kind: "link", title: "Архив полезных ссылок", description: "Всё нужное под рукой" },
] as const;

export type ArchiveKind = typeof ARCHIVE_SECTIONS[number]["kind"];
export type ArchiveFile = { id: string; name: string; size: number; extension: string };
export type ArchiveItem = {
  id: string; kind: ArchiveKind; title: string; discipline: string; url: string;
  file: ArchiveFile | null; extension: string; revision: number; createdAt: string; updatedAt: string;
};
export const MAX_ARCHIVE_FILE_BYTES = 4 * 1024 * 1024;
export const ARCHIVE_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "ods", "odp", "rtf", "txt", "csv", "json", "md", "jpg", "jpeg", "png", "webp", "gif", "avif", "mp3", "wav", "m4a", "ogg", "mp4", "webm", "mov", "zip", "rar", "7z"];
export const OFFICE_EXTENSIONS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "ods", "odp", "rtf"]);

export function archiveExtension(value: string) {
  try { value = new URL(value).pathname; } catch { /* A filename is also valid. */ }
  return value.split(".").pop()?.toLowerCase() ?? "";
}

export function archiveUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4000) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function youtubeUrl(value: unknown): string | null {
  const valid = archiveUrl(value);
  if (!valid) return null;
  const url = new URL(valid);
  const host = url.hostname.toLowerCase();
  if (!["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) return null;
  // Standard HTTPS links allow the OS to hand off to the YouTube app.
  return url.href;
}

export function parseArchiveInput(input: Record<string, unknown>, hasFile: boolean) {
  const kind = input.kind;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const discipline = typeof input.discipline === "string" ? input.discipline.trim() : "";
  if (!ARCHIVE_SECTIONS.some(section => section.kind === kind)) throw new Error("Выбери раздел архива");
  if (!title || title.length > 160) throw new Error("Укажи название до 160 символов");
  if (discipline.length > 160 || (kind === "show" && !discipline)) throw new Error("Укажи дисциплину до 160 символов");
  const url = kind === "show" ? youtubeUrl(input.url) : archiveUrl(input.url);
  if (!(kind === "file" && hasFile) && !url) throw new Error(kind === "show" ? "Укажи ссылку на YouTube (https://…)" : "Укажи полную HTTPS-ссылку");
  const extension = typeof input.extension === "string" ? input.extension : archiveExtension(url ?? "");
  if (kind === "file" && !hasFile && !ARCHIVE_EXTENSIONS.includes(extension)) throw new Error("Выбери формат файла");
  return { kind: kind as ArchiveKind, title, discipline: kind === "show" ? discipline : "", url: kind === "file" && hasFile ? "" : url!, extension: kind === "file" ? extension : "" };
}

export function archiveFileUrl(item: ArchiveItem) {
  return item.file ? `/api/archive/files/${item.file.id}/${encodeURIComponent(item.file.name)}` : item.url;
}

export function archivePreviewKind(extension: string) {
  if (OFFICE_EXTENSIONS.has(extension)) return "office";
  if (extension === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension)) return "image";
  if (["mp3", "wav", "m4a", "ogg"].includes(extension)) return "audio";
  if (["mp4", "webm", "mov"].includes(extension)) return "video";
  if (["txt", "csv", "json", "md"].includes(extension)) return "text";
  return "download";
}
