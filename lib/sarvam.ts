import axios from "axios";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { OUTPUTS_DIR, ensureStorageDirectories } from "./files";
import type { Language } from "./types";

const apiKey = process.env.SARVAM_API_KEY;
const baseURL = process.env.SARVAM_BASE_URL;
export const sarvam = axios.create({ baseURL, headers: apiKey ? { "api-subscription-key": apiKey } : {}, timeout: 120_000 });

// Preserve Sarvam's structured error message instead of returning Axios's vague
// "Request failed with status code 400" to the dashboard.
sarvam.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: { message?: string } | string; message?: string } | undefined;
    const detail = typeof payload?.error === "string" ? payload.error : payload?.error?.message ?? payload?.message;
    const status = error.response?.status ?? "network";
    return Promise.reject(new Error(`Sarvam API error (${status}): ${detail ?? error.message}`));
  }
  return Promise.reject(error);
});

const LANGUAGE_CODES: Record<Language, string> = {
  Hindi: "hi-IN", Tamil: "ta-IN", Telugu: "te-IN", Kannada: "kn-IN", Malayalam: "ml-IN",
  Marathi: "mr-IN", Gujarati: "gu-IN", Bengali: "bn-IN", English: "en-IN",
};

interface SttResponse { transcript: string }
interface TranslateResponse { translated_text: string }
interface TtsResponse { audios: string[] }
interface ChatResponse { choices: Array<{ message: { content: string | null } }> }
interface BatchJobResponse { job_id?: string }
interface BatchStatusResponse { job_state?: string; error_message?: string; job_details?: Array<{ state?: string; error_message?: string | null; outputs?: Array<{ file_name?: string }> }> }
interface DiarizedEntry { speaker_id?: string | number; transcript?: string; start_time_seconds?: number; end_time_seconds?: number }
export interface DiarizedSegment { speakerId: string; text: string; startSeconds: number; endSeconds: number }

function assertConfigured() {
  if (!apiKey || !baseURL) throw new Error("Missing SARVAM_API_KEY or SARVAM_BASE_URL in .env.local.");
}

export async function transcribe(audioPath: string): Promise<string> {
  assertConfigured();
  const audio = await readFile(audioPath);
  const formData = new FormData();
  formData.append("file", new Blob([audio], { type: "audio/wav" }), path.basename(audioPath));
  const { data } = await sarvam.post<SttResponse>("/speech-to-text", formData);
  if (!data.transcript) throw new Error("Sarvam STT returned an empty transcript.");
  return data.transcript;
}

function readSignedUrl(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["file_url", "url", "upload_url", "download_url"]) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  return Object.values(record).find((item): item is string => typeof item === "string");
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Uses Sarvam Batch STT because diarization is intentionally not available in
 * the synchronous STT endpoint. The signed-URL response is read defensively:
 * Sarvam's API returns a filename-keyed map, while the URL value may be wrapped.
 */
export async function diarize(audioPath: string, speakerCount?: number): Promise<DiarizedSegment[]> {
  assertConfigured();
  if (speakerCount !== undefined && (!Number.isInteger(speakerCount) || speakerCount < 2 || speakerCount > 20)) throw new Error("Speaker count must be between 2 and 20.");
  const parameters: Record<string, unknown> = { model: "saaras:v3", mode: "transcribe", language_code: "unknown", with_diarization: true };
  if (speakerCount) parameters.num_speakers = speakerCount;
  const { data: job } = await sarvam.post<BatchJobResponse>("/speech-to-text/job/v1", { job_parameters: parameters });
  if (!job.job_id) throw new Error("Sarvam Batch STT did not return a job ID.");
  const fileName = path.basename(audioPath);
  const { data: uploadData } = await sarvam.post<{ upload_urls?: Record<string, unknown> }>("/speech-to-text/job/v1/upload-files", { job_id: job.job_id, files: [fileName] });
  const uploadUrl = readSignedUrl(uploadData.upload_urls?.[fileName]);
  if (!uploadUrl) throw new Error("Sarvam Batch STT did not return an upload URL for the audio file.");
  try {
    // Sarvam returns Azure Blob SAS URLs. Azure requires this header when a
    // block blob is written directly with PUT.
    await axios.put(uploadUrl, await readFile(audioPath), { headers: { "Content-Type": "audio/wav", "x-ms-blob-type": "BlockBlob" }, maxBodyLength: Infinity, maxContentLength: Infinity });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = typeof error.response?.data === "string" ? error.response.data : JSON.stringify(error.response?.data ?? {});
      throw new Error(`Sarvam storage upload failed (${error.response?.status ?? "network"}): ${detail || error.message}`);
    }
    throw error;
  }
  await sarvam.post(`/speech-to-text/job/v1/${job.job_id}/start`, {});

  let outputFile: string | undefined;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await delay(5_000);
    const { data: status } = await sarvam.get<BatchStatusResponse>(`/speech-to-text/job/v1/${job.job_id}/status`);
    const state = status.job_state?.toLowerCase();
    const failedDetail = status.job_details?.find((detail) => detail.state?.toLowerCase() === "failed");
    if (["failed", "cancelled", "canceled"].includes(state ?? "") || failedDetail) throw new Error(`Sarvam Batch STT job failed: ${failedDetail?.error_message ?? status.error_message ?? state ?? "unknown error"}`);
    outputFile = status.job_details?.flatMap((detail) => detail.outputs ?? []).map((file) => file.file_name).find(Boolean);
    if (state === "completed") break;
  }
  if (!outputFile) throw new Error("Sarvam Batch STT did not complete within five minutes or returned no diarization file.");
  const { data: downloadData } = await sarvam.post<{ download_urls?: Record<string, unknown> }>("/speech-to-text/job/v1/download-files", { job_id: job.job_id, files: [outputFile] });
  const downloadUrl = readSignedUrl(downloadData.download_urls?.[outputFile]);
  if (!downloadUrl) throw new Error("Sarvam Batch STT did not return a diarization download URL.");
  const { data: transcript } = await axios.get<{ diarized_transcript?: { entries?: DiarizedEntry[] } }>(downloadUrl);
  const entries = transcript.diarized_transcript?.entries ?? [];
  const segments = entries.map((entry) => ({ speakerId: String(entry.speaker_id ?? "speaker-1"), text: entry.transcript?.trim() ?? "", startSeconds: Number(entry.start_time_seconds ?? 0), endSeconds: Number(entry.end_time_seconds ?? 0) })).filter((entry) => entry.text.length > 0);
  if (!segments.length) throw new Error("Sarvam Batch STT returned no diarized speech segments.");
  return segments;
}

export async function translate(text: string, targetLanguage: Language): Promise<string> {
  assertConfigured();
  if (text.length > 2_000) throw new Error("Transcript exceeds Sarvam Translate's 2,000-character REST limit.");
  const { data } = await sarvam.post<TranslateResponse>("/translate", {
    input: text,
    source_language_code: "auto",
    target_language_code: LANGUAGE_CODES[targetLanguage],
  });
  if (!data.translated_text) throw new Error("Sarvam Translate returned empty text.");
  return data.translated_text;
}

/** Rewrites a translated script to match a creator's requested delivery style. */
export async function improveScript(text: string, targetLanguage: Language, prompt?: string): Promise<string> {
  if (!prompt?.trim()) return text;
  assertConfigured();
  const { data } = await sarvam.post<ChatResponse>("/v1/chat/completions", {
    model: "sarvam-30b",
    temperature: 0.35,
    max_tokens: 1400,
    messages: [
      { role: "system", content: `You refine translated UGC voiceover scripts for ${targetLanguage}. Preserve factual meaning and brand/product names. Return only the final spoken script, with no explanation.` },
      { role: "user", content: `Original translated script:\n${text}\n\nCreator direction:\n${prompt}` },
    ],
  });
  const improved = data.choices?.[0]?.message.content?.trim();
  // Prompt refinement is optional. A blank LLM completion must not block the
  // core translation and dubbing path; preserve the already-translated script.
  return improved || text;
}

export async function textToSpeech(text: string, targetLanguage: Language, speaker = "shubh", jobId = randomUUID()): Promise<string> {
  assertConfigured();
  if (text.length > 2_500) throw new Error("Translated text exceeds Sarvam TTS's 2,500-character REST limit.");
  await ensureStorageDirectories();
  const outputPath = path.join(OUTPUTS_DIR, `${jobId}-voice.wav`);
  const { data } = await sarvam.post<TtsResponse>("/text-to-speech", {
    text,
    target_language_code: LANGUAGE_CODES[targetLanguage],
    speaker,
    model: "bulbul:v3",
  });
  if (!data.audios?.length) throw new Error("Sarvam TTS returned no audio.");
  await writeFile(outputPath, Buffer.from(data.audios.join(""), "base64"));
  return outputPath;
}
