import { YoutubeTranscript } from "youtube-transcript";
import ytdl from "ytdl-core";
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
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    if (items?.length) {
      return items.map((i) => i.text).join(" ");
    }
  } catch {
    // ignore
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


