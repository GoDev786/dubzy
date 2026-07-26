import { NextResponse } from "next/server";
import { textToSpeech } from "@/lib/sarvam";
import { LANGUAGES } from "@/lib/types";
export const runtime = "nodejs";
export async function POST(request: Request) { try { const { text, targetLanguage, speaker } = await request.json(); if (typeof text !== "string" || !LANGUAGES.includes(targetLanguage)) throw new Error("Valid text and targetLanguage are required"); return NextResponse.json({ audioPath: await textToSpeech(text, targetLanguage, typeof speaker === "string" ? speaker : undefined) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Speech generation failed" }, { status: 500 }); } }
