import { NextResponse } from "next/server";
import { mergeVideo } from "@/lib/ffmpeg";
import { publicOutputUrl } from "@/lib/files";
import path from "path";
import { randomUUID } from "crypto";
export const runtime = "nodejs";
export async function POST(request: Request) { try { const { videoPath, voicePath } = await request.json(); if (typeof videoPath !== "string" || typeof voicePath !== "string") throw new Error("videoPath and voicePath are required"); const finalPath = await mergeVideo(videoPath, voicePath, randomUUID()); return NextResponse.json({ finalPath, downloadUrl: publicOutputUrl(path.basename(finalPath)) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Video merge failed" }, { status: 500 }); } }
