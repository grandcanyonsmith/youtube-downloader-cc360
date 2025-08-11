import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "thumbnails";
const SUPABASE_TRANSCRIPTS_BUCKET = process.env.SUPABASE_TRANSCRIPTS_BUCKET || "transcripts";

let supabase: ReturnType<typeof createClient> | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// AWS S3
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_S3_PUBLIC_DOMAIN = process.env.AWS_S3_PUBLIC_DOMAIN; // optional custom domain or static website domain

let s3Client: S3Client | null = null;
function getS3Client(): S3Client | null {
  if (s3Client) return s3Client;
  if (!AWS_REGION || !AWS_S3_BUCKET) return null;
  try {
    s3Client = new S3Client({ region: AWS_REGION });
  } catch {
    s3Client = null;
  }
  return s3Client;
}

type UploadableBinary = ArrayBuffer | Uint8Array | Buffer;

export async function uploadBufferToS3(key: string, buffer: UploadableBinary, contentType: string): Promise<string | null> {
  const client = getS3Client();
  if (!client || !AWS_S3_BUCKET) return null;
  let body: Buffer;
  if (buffer instanceof Buffer) {
    body = buffer as Buffer;
  } else if (buffer instanceof Uint8Array) {
    body = Buffer.from(buffer as Uint8Array);
  } else {
    body = Buffer.from(new Uint8Array(buffer as ArrayBuffer));
  }
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: "public-read",
      })
    );
    if (AWS_S3_PUBLIC_DOMAIN) {
      return `https://${AWS_S3_PUBLIC_DOMAIN.replace(/\/$/, "")}/${key}`;
    }
    const region = AWS_REGION || "us-east-1";
    return `https://${AWS_S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
  } catch {
    return null;
  }
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

export async function uploadTranscriptText(videoId: string, text: string): Promise<string | null> {
  try {
    if (!supabase || !text) return null;
    const blob = new Blob([text], { type: "text/plain" });
    const path = `${videoId}.txt`;
    await supabase.storage.from(SUPABASE_TRANSCRIPTS_BUCKET).upload(path, blob, { upsert: true, contentType: "text/plain" });
    const { data } = supabase.storage.from(SUPABASE_TRANSCRIPTS_BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

export async function uploadAudioM4AToS3(videoId: string, buffer: ArrayBuffer | Buffer): Promise<string | null> {
  const key = `${videoId}.m4a`;
  return uploadBufferToS3(key, buffer, "audio/mp4");
}


