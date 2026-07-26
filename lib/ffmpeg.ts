import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import { OUTPUTS_DIR, ensureStorageDirectories } from "./files";

if (!ffmpegPath) throw new Error("ffmpeg-static binary is unavailable for this platform.");
ffmpeg.setFfmpegPath(ffmpegPath);

function run(command: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => command.on("end", () => resolve()).on("error", reject).run());
}

/** Extracts a PCM WAV file suitable for speech-to-text services. */
export async function extractAudio(videoPath: string, jobId: string): Promise<string> {
  await ensureStorageDirectories();
  const audioPath = path.join(OUTPUTS_DIR, `${jobId}-audio.wav`);
  await run(ffmpeg(videoPath).noVideo().audioChannels(1).audioFrequency(16000).format("wav").output(audioPath));
  return audioPath;
}

/** Replaces source audio while preserving the source video stream. */
export async function mergeVideo(videoPath: string, voicePath: string, jobId: string): Promise<string> {
  await ensureStorageDirectories();
  const outputPath = path.join(OUTPUTS_DIR, `${jobId}-final.mp4`);
  await run(ffmpeg().input(videoPath).input(voicePath).outputOptions(["-map 0:v:0", "-map 1:a:0", "-c:v copy", "-c:a aac", "-shortest", "-movflags +faststart"]).output(outputPath));
  return outputPath;
}

/** Mixes diarized speech clips back at their original speaking offsets. */
export async function mergeDiarizedVideo(videoPath: string, clips: Array<{ voicePath: string; startSeconds: number }>, jobId: string): Promise<string> {
  if (!clips.length) throw new Error("No diarized audio clips were generated.");
  await ensureStorageDirectories();
  const outputPath = path.join(OUTPUTS_DIR, `${jobId}-final.mp4`);
  const command = ffmpeg().input(videoPath);
  clips.forEach((clip) => command.input(clip.voicePath));
  const filters = clips.map((clip, index) => `[${index + 1}:a]adelay=${Math.max(0, Math.round(clip.startSeconds * 1000))}|${Math.max(0, Math.round(clip.startSeconds * 1000))}[voice${index}]`);
  const mixedInputs = clips.map((_, index) => `[voice${index}]`).join("");
  filters.push(`${mixedInputs}amix=inputs=${clips.length}:duration=longest:normalize=0[mixed]`);
  await run(command.complexFilter(filters).outputOptions(["-map 0:v:0", "-map [mixed]", "-c:v copy", "-c:a aac", "-shortest", "-movflags +faststart"]).output(outputPath));
  return outputPath;
}
