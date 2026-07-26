import { NextResponse } from "next/server";
import { translate } from "@/lib/sarvam";
import { LANGUAGES } from "@/lib/types";
export async function POST(request: Request) { try { const { text, targetLanguage } = await request.json(); if (typeof text !== "string" || !LANGUAGES.includes(targetLanguage)) throw new Error("Valid text and targetLanguage are required"); return NextResponse.json({ text: await translate(text, targetLanguage) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Translation failed" }, { status: 500 }); } }
