import { YoutubeTranscript } from "youtube-transcript";
import ytdl from "ytdl-core";
import { uploadAudioM4AToS3 } from "./storage";
import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (openaiInstance !== null) return openaiInstance;
  if (!process.env.OPENAI_API_KEY) {
    openaiInstance = null;
    return null;
  }
  try {
    openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch {
    openaiInstance = null;
  }
  return openaiInstance;
}

export async function getTranscriptText(videoId: string): Promise<string> {
  // Try multiple common English locales and fallback without lang hint
  const langs = ["en", "en-US", "en-GB", undefined] as const;
  for (const lang of langs) {
    try {
      const items = lang
        ? await YoutubeTranscript.fetchTranscript(videoId, { lang })
        : await YoutubeTranscript.fetchTranscript(videoId);
      if (items?.length) {
        return items.map((i) => i.text).join(" ");
      }
    } catch {
      // continue
    }
  }

  // Optional Whisper fallback
  const enableWhisper = String(process.env.ENABLE_WHISPER_FALLBACK || "false").toLowerCase() === "true";
  const openai = getOpenAI();
  if (!enableWhisper || !openai) return "";

  try {
    const info = await ytdl.getInfo(videoId);
    const format = ytdl.chooseFormat(info.formats, { quality: "lowestaudio" });
    if (!format?.url) return "";

    const res = await fetch(format.url);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const blob = new Blob([buffer], { type: "audio/mpeg" });

    // openai v5 SDK transcription
    const transcript = await openai.audio.transcriptions.create({
      file: blob as unknown as File,
      model: "gpt-4o-transcribe",
      temperature: 0,
    });
    return transcript?.text || "";
  } catch {
    return "";
  }
}


export async function downloadAndUploadM4A(videoId: string): Promise<string | null> {
  try {
    const info = await ytdl.getInfo(videoId);
    // pick an audio-only format that is m4a (mp4 container)
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: (f) => Boolean(f.mimeType?.includes("audio/")) && /mp4|m4a/.test(f.container || ""),
    });
    if (!audioFormat?.url) {
      // fallback: any audio-only
      const fallback = ytdl.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" });
      if (!fallback?.url || !/mp4|m4a/.test(fallback.container || "")) return null;
      const res = await fetch(fallback.url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return await uploadAudioM4AToS3(videoId, arr);
    }
    const res = await fetch(audioFormat.url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return await uploadAudioM4AToS3(videoId, arr);
  } catch {
    return null;
  }
}


