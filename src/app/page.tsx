"use client";
import { useEffect, useRef, useState } from "react";

type Row = {
  videoId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  thumbnailURL: string;
  audioURL?: string;
  transcript?: string;
  transcriptURL?: string;
  publishedAt: string;
};

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Array<{id:string; query:string; createdAt:string; videoCount:number}>>([]);
  const [limit, setLimit] = useState<number>(100);
  const [showTranscripts, setShowTranscripts] = useState<boolean>(false);

  useEffect(() => {
    // load recent jobs on mount
    fetch("/api/jobs").then(r=>r.json()).then((list)=>{
      setJobs(list);
      if (list?.[0]?.id) {
        // load latest job results
        fetch(`/api/results?jobId=${list[0].id}`).then(res=>res.json()).then(data=>{
          setRows(data.rows);
          setJobId(list[0].id);
        }).catch(()=>{});
      }
    }).catch(()=>{});
  }, []);

  async function startScrape() {
    setRows([]);
    setLogs([]);
    setProgress(null);
    setJobId(null);
    const input = inputRef.current?.value?.trim();
    if (!input) return;
    const resp = await fetch("/api/scrape", { method: "POST", body: JSON.stringify({ input, limit }) });
    if (!resp.ok || !resp.body) {
      setLogs((l) => [...l, "Failed to start scrape"]);
      return;
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        const json = part.replace(/^data: /, "");
        try {
          const evt = JSON.parse(json);
          if (evt.type === "info") setLogs((l) => [...l, evt.message]);
          if (evt.type === "progress") setProgress({ current: evt.current, total: evt.total });
          if (evt.type === "done") {
            setLogs((l) => [...l, "Completed"]);
            setJobId(evt.jobId);
            // fetch results for display
            const res = await fetch(`/api/results?jobId=${evt.jobId}`);
            const data = await res.json();
            setRows(data.rows);
          }
          if (evt.type === "error") setLogs((l) => [...l, `Error: ${evt.message}`]);
        } catch {}
      }
    }
  }

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-4">YouTube Channel Scraper</h1>
      <div className="flex gap-2 mb-2 items-center">
        <input ref={inputRef} className="border rounded px-3 py-2 w-full" placeholder="Channel URL or name (e.g., Alex Moey or https://youtube.com/@alexmoey)" />
        <input type="number" min={1} max={100} value={limit} onChange={(e)=>setLimit(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="border rounded px-3 py-2 w-28" title="Max videos" />
        <button onClick={startScrape} className="bg-black text-white px-4 py-2 rounded">Start</button>
      </div>
      <div className="flex items-center gap-2 mb-4 text-sm">
        <input id="show-transcripts" type="checkbox" checked={showTranscripts} onChange={(e)=>setShowTranscripts(e.target.checked)} />
        <label htmlFor="show-transcripts">Show transcripts</label>
      </div>
      {jobs.length > 0 && (
        <div className="mb-4">
          <div className="font-medium mb-1">Recent scrapes</div>
          <ul className="space-y-1 text-sm">
            {jobs.map(j => (
              <li key={j.id} className="flex items-center justify-between">
                <span>{j.query} · {new Date(j.createdAt).toLocaleString()} · {j.videoCount} videos</span>
                <button className="underline" onClick={async()=>{
                  const res = await fetch(`/api/results?jobId=${j.id}`);
                  const data = await res.json();
                  setRows(data.rows);
                  setJobId(j.id);
                }}>Load</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {progress && (
        <div className="mb-4">
          <div className="text-sm">Progress: {progress.current} / {progress.total}</div>
          <div className="w-full bg-gray-200 h-2 rounded">
            <div className="bg-blue-600 h-2 rounded" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
        </div>
      )}
      {logs.length > 0 && (
        <div className="mb-4 text-sm text-gray-600 space-y-1">
          {logs.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
      {jobId && (
        <div className="mb-4 flex gap-3">
          <a className="underline" href={`/api/export/csv?jobId=${jobId}`}>Download CSV</a>
          <a className="underline" href={`/api/export/xlsx?jobId=${jobId}`}>Download Excel</a>
        </div>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2">Thumbnail</th>
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2">Views</th>
                <th className="text-left p-2">Likes</th>
                <th className="text-left p-2">Comments</th>
                <th className="text-left p-2">Published</th>
                <th className="text-left p-2">Audio</th>
                {showTranscripts && <th className="text-left p-2">Transcript</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.videoId} className="border-t">
                  <td className="p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.thumbnailURL} alt={r.title} className="h-16 w-28 object-cover rounded" />
                  </td>
                  <td className="p-2">{r.title}</td>
                  <td className="p-2">{r.views.toLocaleString()}</td>
                  <td className="p-2">{r.likes.toLocaleString()}</td>
                  <td className="p-2">{r.comments.toLocaleString()}</td>
                  <td className="p-2">{new Date(r.publishedAt).toLocaleDateString()}</td>
                  <td className="p-2">
                    {r.audioURL ? (
                      <a href={r.audioURL} target="_blank" className="underline text-blue-600">Open</a>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  {showTranscripts && (
                    <td className="p-2 max-w-[400px]">
                      {r.transcriptURL ? (
                        <a href={r.transcriptURL} target="_blank" className="underline text-blue-600">Open</a>
                      ) : r.transcript ? (
                        <details>
                          <summary className="cursor-pointer underline text-blue-600">View</summary>
                          <div className="mt-2 whitespace-pre-wrap break-words text-gray-700">
                            {r.transcript}
                          </div>
                        </details>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
