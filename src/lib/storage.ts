import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "thumbnails";

let supabase: ReturnType<typeof createClient> | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export async function uploadThumbnailFromUrl(videoId: string, url: string): Promise<string> {
  try {
    if (!supabase) return url; // fallback: keep YouTube URL
    const res = await fetch(url);
    if (!res.ok) return url;
    const arrayBuffer = await res.arrayBuffer();
    const path = `${videoId}.jpg`;
    await supabase.storage.from(SUPABASE_BUCKET).upload(path, arrayBuffer, { upsert: true, contentType: "image/jpeg" });
    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || url;
  } catch {
    return url;
  }
}


