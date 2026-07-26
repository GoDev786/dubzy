"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "@/components/Upload";
import { VideoPreview } from "@/components/VideoPreview";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Progress } from "@/components/Progress";
import { ShareButton } from "@/components/ShareButton";
import type { Language, ProcessStep } from "@/lib/types";

export default function Home() {
  const [studioOpen, setStudioOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [languages, setLanguages] = useState<Language[]>(["Hindi"]);
  const [voice, setVoice] = useState<"female" | "male">("female");
  const [multiSpeaker, setMultiSpeaker] = useState(false);
  const [speakerCount, setSpeakerCount] = useState<2 | 3 | 4>(2);
  const [speakerGenders, setSpeakerGenders] = useState<Array<"female" | "male">>(["female", "male", "female", "male"]);
  const [improvementPrompt, setImprovementPrompt] = useState("");
  const [recordMode, setRecordMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [step, setStep] = useState<ProcessStep>("idle");
  const [error, setError] = useState("");
  const [outputs, setOutputs] = useState<{ language: Language; downloadUrl: string }[]>([]);
  const progressTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const cameraPreview = useRef<HTMLVideoElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); if (progressTimer.current) clearInterval(progressTimer.current); }, [preview]);

  function selectFile(next: File) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next)); setOutputs([]); setError(""); setStep("idle");
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      if (cameraPreview.current) cameraPreview.current.srcObject = stream;
      const chunks: BlobPart[] = [];
      const next = new MediaRecorder(stream);
      next.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        selectFile(new File([new Blob(chunks, { type: "video/webm" })], `dubzy-recording-${Date.now()}.webm`, { type: "video/webm" }));
        setRecording(false); setRecordMode(false);
      };
      recorder.current = next; next.start(); setRecording(true);
    } catch { setError("Camera access was denied. Allow camera and microphone access, then try again."); }
  }

  function stopRecording() { if (recorder.current?.state === "recording") recorder.current.stop(); }

  async function generate() {
    if (!file || !languages.length) return;
    try {
      setError(""); setOutputs([]); setStep("uploading");
      const form = new FormData(); form.append("video", file);
      const upload = await fetch("/api/upload", { method: "POST", body: form });
      const uploaded = await upload.json();
      if (!upload.ok) throw new Error(uploaded.error || "Upload failed");
      const stages: ProcessStep[] = ["extracting", "transcribing", "translating", "speaking", "merging"];
      let index = 0; setStep(stages[index]);
      progressTimer.current = setInterval(() => { index = Math.min(index + 1, stages.length - 1); setStep(stages[index]); }, multiSpeaker ? 6_000 : 2_500);
      const processing = await fetch("/api/process", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath: uploaded.videoPath, targetLanguages: languages, speaker: voice === "female" ? "priya" : "shubh", improvementPrompt, multiSpeaker, speakerCount: multiSpeaker ? speakerCount : undefined, speakerVoices: multiSpeaker ? speakerGenders.slice(0, speakerCount).map((gender) => gender === "female" ? "priya" : "shubh") : undefined }),
      });
      const result = await processing.json();
      if (!processing.ok) throw new Error(result.error || "Processing failed");
      setStep("completed"); setOutputs(result.outputs);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong"); setStep("error"); }
    finally { if (progressTimer.current) clearInterval(progressTimer.current); }
  }

  const busy = !["idle", "completed", "error"].includes(step);
  return <main className="relative isolate min-h-screen overflow-hidden text-white">
    <div aria-hidden className="absolute inset-0 -z-20 bg-cover bg-center" style={{ backgroundImage: "url('/dubzy-landing.png')" }} />
    <div aria-hidden className="absolute inset-0 -z-10 bg-black/5" />
    <button aria-label="Upload a video" onClick={() => setStudioOpen(true)} className="absolute left-[12%] top-[62%] h-[10%] w-[27%] rounded-2xl focus:outline-none focus:ring-4 focus:ring-fuchsia-300/80"><span className="sr-only">Upload a video</span></button>
    <button aria-label="Record a video" onClick={() => { setRecordMode(true); setStudioOpen(true); }} className="absolute bottom-[6%] left-1/2 inline-flex h-14 -translate-x-1/2 items-center justify-center gap-2 rounded-full border border-rose-200/80 bg-gradient-to-r from-rose-500 to-fuchsia-600 px-6 text-sm font-bold text-white shadow-2xl shadow-rose-950/70 transition hover:scale-[1.04] hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-rose-300/80"><span className="relative flex h-4 w-4 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" /><span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-rose-500" /></span>Record a video</button>
    {studioOpen && <div className="fixed inset-0 z-20 overflow-y-auto bg-[#090018]/70 p-4 backdrop-blur-md"><div className="mx-auto my-4 max-w-6xl rounded-[2rem] border border-white/20 bg-[#fafaff] p-5 text-slate-900 shadow-2xl md:my-10 md:p-7">
      <div className="mb-6 flex items-center justify-between"><div><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white">◉</span><h2 className="text-xl font-bold">dubzy Studio</h2></div><p className="mt-1 text-sm text-slate-500">Create a new regional version of your video.</p></div><button onClick={() => !busy && setStudioOpen(false)} disabled={busy} aria-label="Close studio" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40">×</button></div>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">Your source video</h3><button onClick={() => setRecordMode((value) => !value)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">{recordMode ? "Use upload" : "Record with camera"}</button></div>{recordMode ? <div className="overflow-hidden rounded-2xl bg-slate-950"><video ref={cameraPreview} className="aspect-video w-full" autoPlay muted playsInline /><div className="flex justify-center p-4">{recording ? <button onClick={stopRecording} className="rounded-full bg-rose-600 px-5 py-3 font-bold text-white">■ Stop recording</button> : <button onClick={startRecording} className="rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-600 px-5 py-3 font-bold text-white">● Start recording</button>}</div></div> : preview && file ? <VideoPreview src={preview} title={file.name} /> : <Upload onFile={selectFile} />}</section>
        <aside className="rounded-3xl border border-fuchsia-100 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">Dub settings</h3><span className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-700">{languages.length} selected</span></div><LanguageSelector value={languages} onChange={setLanguages} />
          <div className="mt-5"><p className="text-sm font-semibold text-slate-700">Voice style</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setVoice("female")} className={`rounded-xl px-3 py-3 text-sm font-semibold ${voice === "female" ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-200" : "border border-slate-200 bg-white text-slate-600"}`}>Female voice</button><button type="button" onClick={() => setVoice("male")} className={`rounded-xl px-3 py-3 text-sm font-semibold ${voice === "male" ? "bg-violet-600 text-white shadow-lg shadow-violet-200" : "border border-slate-200 bg-white text-slate-600"}`}>Male voice</button></div></div>
          <div className="mt-5 rounded-2xl border border-violet-200 bg-white/80 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">Multiple speakers</p><p className="mt-1 text-xs text-slate-500">Detect each person and keep their lines at the original timing.</p></div><button type="button" role="switch" aria-checked={multiSpeaker} onClick={() => setMultiSpeaker((value) => !value)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${multiSpeaker ? "bg-violet-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${multiSpeaker ? "left-6" : "left-1"}`} /></button></div>{multiSpeaker && <><label className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-600">People in this video<select value={speakerCount} onChange={(event) => setSpeakerCount(Number(event.target.value) as 2 | 3 | 4)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700"><option value={2}>2 speakers</option><option value={3}>3 speakers</option><option value={4}>4 speakers</option></select></label><div className="mt-3 space-y-2 border-t border-violet-100 pt-3"><p className="text-xs font-semibold text-slate-600">Speaker voice assignment</p>{speakerGenders.slice(0, speakerCount).map((gender, index) => <div key={index} className="flex items-center justify-between text-xs"><span className="font-medium text-slate-600">Speaker {index + 1}</span><div className="flex rounded-lg border border-slate-200 bg-white p-0.5"><button type="button" onClick={() => setSpeakerGenders((current) => current.map((item, itemIndex) => itemIndex === index ? "female" : item))} className={`rounded-md px-2 py-1 ${gender === "female" ? "bg-fuchsia-600 text-white" : "text-slate-500"}`}>Female</button><button type="button" onClick={() => setSpeakerGenders((current) => current.map((item, itemIndex) => itemIndex === index ? "male" : item))} className={`rounded-md px-2 py-1 ${gender === "male" ? "bg-violet-600 text-white" : "text-slate-500"}`}>Male</button></div></div>)}</div></>}</div>
          <label className="mt-5 block text-sm font-semibold text-slate-700">Improve this dub<textarea value={improvementPrompt} onChange={(event) => setImprovementPrompt(event.target.value)} maxLength={500} placeholder="e.g. Make it energetic for a beauty reel; keep product names in English." className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal outline-none focus:border-fuchsia-500" /></label><p className="mt-1 text-xs text-slate-500">Dubzy uses this direction to refine the translated script before speech generation.</p><button disabled={!file || busy || !languages.length} onClick={generate} className="mt-6 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 px-4 py-3 font-semibold text-white shadow-xl shadow-violet-300 transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300">{busy ? multiSpeaker ? "Identifying speakers and creating dubs..." : "Creating your translations..." : `Generate ${languages.length} translated video${languages.length === 1 ? "" : "s"}`}</button><Progress step={step} error={error} /></aside>
      </div>
      {outputs.length > 0 && <section className="mt-7 border-t border-slate-200 pt-7"><div className="mb-4"><h3 className="text-xl font-bold">Your dubs are ready</h3><p className="text-sm text-slate-500">Preview, download, or share each version.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{outputs.map(({ language, downloadUrl }) => <article key={language} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"><div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 text-xs text-white">◉</span><div><p className="text-xs font-bold">dubzy</p><p className="text-[10px] text-slate-500">{language} dub</p></div></div><video className="aspect-[9/14] w-full bg-black object-cover" controls playsInline src={downloadUrl} /><div className="space-y-3 p-3"><p className="text-xs font-medium text-slate-700">Your translated {language} video is ready.</p><a href={downloadUrl} download className="block rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white">Download video</a><ShareButton url={downloadUrl} language={language} /></div></article>)}</div></section>}
    </div></div>}
  </main>;
}
