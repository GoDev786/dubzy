export const LANGUAGES = ["Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Gujarati", "Bengali", "English"] as const;
export type Language = (typeof LANGUAGES)[number];
export type ProcessStep = "idle" | "uploading" | "extracting" | "transcribing" | "translating" | "speaking" | "merging" | "completed" | "error";

export interface ProcessRequest {
  videoPath: string;
  targetLanguages: Language[];
  speaker?: string;
  improvementPrompt?: string;
  /** Beta: find and preserve separate speakers through Batch STT diarization. */
  multiSpeaker?: boolean;
  /** Optional known number of voices (2–20); omit to let Sarvam infer it. */
  speakerCount?: number;
  /** Voice assigned to each detected speaker, in speaker-ID discovery order. */
  speakerVoices?: string[];
}
