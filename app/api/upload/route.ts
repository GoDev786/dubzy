import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { UPLOADS_DIR, ensureStorageDirectories } from "@/lib/files";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData(); const file = formData.get("video");
    if (!(file instanceof File) || !file.type.startsWith("video/")) return NextResponse.json({ error: "Please upload a video file." }, { status: 400 });
    await ensureStorageDirectories();
    const extension = path.extname(file.name).replace(/[^.a-zA-Z0-9]/g, "") || ".mp4";
    const fileName = `${randomUUID()}${extension}`; const filePath = path.join(UPLOADS_DIR, fileName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ videoPath: filePath, fileName });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 }); }
}
