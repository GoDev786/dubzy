"use client";
import { ChangeEvent, DragEvent, useRef, useState } from "react";

export function Upload({ onFile }: { onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null); const [dragging, setDragging] = useState(false);
  function accept(file?: File) { if (file?.type.startsWith("video/")) onFile(file); }
  return <div onClick={() => input.current?.click()} onDragOver={(e: DragEvent) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e: DragEvent) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]); }} className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${dragging ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300"}`}>
    <input ref={input} className="hidden" type="file" accept="video/*" onChange={(e: ChangeEvent<HTMLInputElement>) => accept(e.target.files?.[0])} />
    <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-violet-100 text-2xl">↑</div><p className="font-semibold">Drop your UGC video here</p><p className="mt-1 text-sm text-slate-500">MP4, MOV, WebM and other video formats</p>
  </div>;
}
