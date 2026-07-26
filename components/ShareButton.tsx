"use client";
import { useState } from "react";

export function ShareButton({ url, language }: { url: string; language: string }) {
  const [message, setMessage] = useState("");
  const absoluteUrl = typeof window === "undefined" ? url : `${window.location.origin}${url}`;

  async function share() {
    try {
      const response = await fetch(url); const blob = await response.blob();
      const file = new File([blob], `ugc-voice-${language.toLowerCase()}.mp4`, { type: "video/mp4" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ title: `${language} UGC video`, files: [file] });
      else if (navigator.share) await navigator.share({ title: `${language} UGC video`, url: absoluteUrl });
      else throw new Error("Sharing is not supported by this browser.");
      setMessage("Share sheet opened");
    } catch (error) { if (error instanceof Error && error.name !== "AbortError") setMessage(error.message); }
  }
  async function copyLink() { await navigator.clipboard.writeText(absoluteUrl); setMessage("Local preview link copied"); }

  return <div className="grid grid-cols-2 gap-2"><button onClick={share} className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2 text-xs font-bold text-white">Share to Instagram</button><button onClick={copyLink} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">Copy link</button>{message && <p className="col-span-2 text-center text-[11px] text-slate-500">{message}</p>}</div>;
}
