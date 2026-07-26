import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { OUTPUTS_DIR } from "@/lib/files";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ fileName: string }> }) { try { const { fileName } = await params; const safe = path.basename(fileName); if (safe !== fileName || !safe.endsWith(".mp4")) return new NextResponse("Not found", { status: 404 }); const data = await readFile(path.join(OUTPUTS_DIR, safe)); return new NextResponse(data, { headers: { "Content-Type": "video/mp4", "Content-Disposition": `inline; filename="${safe}"` } }); } catch { return new NextResponse("Not found", { status: 404 }); } }
