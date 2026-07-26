import path from "path";
import { mkdir } from "fs/promises";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
export const OUTPUTS_DIR = path.join(process.cwd(), "outputs");

export async function ensureStorageDirectories() { await Promise.all([mkdir(UPLOADS_DIR, { recursive: true }), mkdir(OUTPUTS_DIR, { recursive: true })]); }
export function publicOutputUrl(fileName: string) { return `/api/outputs/${encodeURIComponent(fileName)}`; }
