export const ARCHIVE_SECTIONS = [
  { kind: "show", title: "Архив показов" },
  { kind: "file", title: "Архив полезных файлов" },
  { kind: "link", title: "Архив полезных ссылок" },
] as const;

export type ArchiveKind = typeof ARCHIVE_SECTIONS[number]["kind"];
export type ArchiveFile = { id: string; name: string; size: number; extension: string };
export type ArchiveCover = ArchiveFile & { width: number; height: number };
export type ArchiveItem = {
  id: string; kind: ArchiveKind; title: string; discipline: string; artisticDirector?: string; date?: string; url: string;
  file: ArchiveFile | null; cover?: ArchiveCover | null; extension: string; revision: number; createdAt: string; updatedAt: string;
};
export const MAX_ARCHIVE_FILE_BYTES = 4 * 1024 * 1024;
export const ARCHIVE_COVER_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
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

export function validArchiveDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) === 0) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function formatArchiveDate(value: string | undefined) {
  if (!validArchiveDate(value)) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function compareArchiveItems(a: ArchiveItem, b: ArchiveItem) {
  // Sections are displayed separately; keep a total ordering across kinds, too.
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
  if (a.kind === "show") {
    const dateA = validArchiveDate(a.date) ? a.date : "";
    const dateB = validArchiveDate(b.date) ? b.date : "";
    const byShowDate = dateB.localeCompare(dateA);
    if (byShowDate) return byShowDate;
  }
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

export function parseArchiveInput(input: Record<string, unknown>, hasFile: boolean) {
  const kind = input.kind;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const discipline = typeof input.discipline === "string" ? input.discipline.trim() : "";
  const artisticDirector = typeof input.artisticDirector === "string" ? input.artisticDirector.trim() : "";
  if (!ARCHIVE_SECTIONS.some(section => section.kind === kind)) throw new Error("Выбери раздел архива");
  if (!title || title.length > 160) throw new Error("Укажи название до 160 символов");
  if (discipline.length > 160 || (kind === "show" && !discipline)) throw new Error("Укажи дисциплину до 160 символов");
  if (kind === "show" && (artisticDirector.length > 160 || (input.artisticDirector != null && typeof input.artisticDirector !== "string"))) throw new Error("Укажи художественного руководителя до 160 символов");
  if (kind === "show" && !validArchiveDate(input.date)) throw new Error("Укажи корректную дату показа");
  const url = kind === "show" ? youtubeUrl(input.url) : archiveUrl(input.url);
  if (!(kind === "file" && hasFile) && !url) throw new Error(kind === "show" ? "Укажи ссылку на YouTube (https://…)" : "Укажи полную HTTPS-ссылку");
  const extension = typeof input.extension === "string" ? input.extension : archiveExtension(url ?? "");
  if (kind === "file" && !hasFile && !ARCHIVE_EXTENSIONS.includes(extension)) throw new Error("Выбери формат файла");
  return { kind: kind as ArchiveKind, title, discipline: kind === "show" ? discipline : "", artisticDirector: kind === "show" ? artisticDirector : "", date: kind === "show" ? input.date as string : "", url: kind === "file" && hasFile ? "" : url!, extension: kind === "file" ? extension : "" };
}

export function archiveFileUrl(item: ArchiveItem) {
  return item.file ? `/api/archive/files/${item.file.id}/${encodeURIComponent(item.file.name)}` : item.url;
}

export function archiveCoverUrl(cover: ArchiveCover) {
  return `/api/archive/files/${cover.id}/${encodeURIComponent(cover.name)}`;
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
