import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { stat } from "fs/promises";
import { extractAudio, mergeDiarizedVideo, mergeVideo } from "@/lib/ffmpeg";
import { diarize, transcribe, translate, textToSpeech, improveScript } from "@/lib/sarvam";
import { UPLOADS_DIR, publicOutputUrl } from "@/lib/files";
import { LANGUAGES, type ProcessRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const DIARIZED_VOICES = ["priya", "shubh", "kavya", "ratan"];

/** Orchestrates isolated processing services; implementation remains in lib modules. */
export async function POST(request: Request) {
  try {
    const body = await request.json() as ProcessRequest;
    if (!body || typeof body.videoPath !== "string" || !Array.isArray(body.targetLanguages) || body.targetLanguages.length === 0 || !body.targetLanguages.every((language) => LANGUAGES.includes(language)) || (body.improvementPrompt !== undefined && (typeof body.improvementPrompt !== "string" || body.improvementPrompt.length > 500)) || (body.multiSpeaker !== undefined && typeof body.multiSpeaker !== "boolean") || (body.speakerCount !== undefined && (!Number.isInteger(body.speakerCount) || body.speakerCount < 2 || body.speakerCount > 20)) || (body.speakerVoices !== undefined && (!Array.isArray(body.speakerVoices) || !body.speakerVoices.every((speaker) => typeof speaker === "string")))) throw new Error("A valid video path, languages, and multi-speaker settings are required.");
    const resolvedVideo = path.resolve(body.videoPath);
    if (!resolvedVideo.startsWith(`${path.resolve(UPLOADS_DIR)}${path.sep}`)) throw new Error("Invalid video path.");
    await stat(resolvedVideo);
    const jobId = randomUUID();
    const audioPath = await extractAudio(resolvedVideo, jobId);
    if (body.multiSpeaker) {
      const segments = await diarize(audioPath, body.speakerCount);
      const speakerIndexes = new Map<string, number>();
      const outputs = await Promise.all(body.targetLanguages.map(async (targetLanguage) => {
        // Segments stay sequential so voice requests do not overload the API on longer videos.
        const clips: Array<{ voicePath: string; startSeconds: number }> = [];
        for (const [index, segment] of segments.entries()) {
          let speakerIndex = speakerIndexes.get(segment.speakerId);
          if (speakerIndex === undefined) { speakerIndex = speakerIndexes.size; speakerIndexes.set(segment.speakerId, speakerIndex); }
          const translatedText = await translate(segment.text, targetLanguage);
          const improvedText = await improveScript(translatedText, targetLanguage, body.improvementPrompt);
          const selectedVoice = body.speakerVoices?.[speakerIndex] ?? DIARIZED_VOICES[speakerIndex % DIARIZED_VOICES.length];
          const voicePath = await textToSpeech(improvedText, targetLanguage, selectedVoice, `${jobId}-${targetLanguage.toLowerCase()}-speaker-${index}`);
          clips.push({ voicePath, startSeconds: segment.startSeconds });
        }
        const finalPath = await mergeDiarizedVideo(resolvedVideo, clips, `${jobId}-${targetLanguage.toLowerCase()}`);
        return { language: targetLanguage, downloadUrl: publicOutputUrl(path.basename(finalPath)) };
      }));
      return NextResponse.json({ outputs, multiSpeaker: true });
    }
    const originalText = await transcribe(audioPath);
    const outputs = await Promise.all(body.targetLanguages.map(async (targetLanguage) => {
      const translatedText = await translate(originalText, targetLanguage);
      const improvedText = await improveScript(translatedText, targetLanguage, body.improvementPrompt);
      const voicePath = await textToSpeech(improvedText, targetLanguage, body.speaker, `${jobId}-${targetLanguage.toLowerCase()}`);
      const finalPath = await mergeVideo(resolvedVideo, voicePath, `${jobId}-${targetLanguage.toLowerCase()}`);
      return { language: targetLanguage, downloadUrl: publicOutputUrl(path.basename(finalPath)) };
    }));
    return NextResponse.json({ outputs });
  } catch (error) { console.error("Video processing failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Video processing failed" }, { status: 500 }); }
}
