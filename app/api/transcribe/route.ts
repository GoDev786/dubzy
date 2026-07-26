import { NextResponse } from "next/server";
import { transcribe } from "@/lib/sarvam";
export const runtime = "nodejs";
export async function POST(request: Request) { try { const { audioPath } = await request.json(); if (typeof audioPath !== "string") throw new Error("audioPath is required"); return NextResponse.json({ text: await transcribe(audioPath) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Transcription failed" }, { status: 500 }); } }
