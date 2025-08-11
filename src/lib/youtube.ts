import { google, youtube_v3 } from "googleapis";

const youtube = google.youtube({ version: "v3", auth: process.env.YOUTUBE_API_KEY });

export type BasicVideo = {
  videoId: string;
  publishedAt: string;
};

export type VideoDetails = {
  videoId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  thumbnailURL: string;
  publishedAt: string;
};

export async function resolveChannelId(input: string): Promise<{ channelId: string; channelTitle: string }> {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@([A-Za-z0-9_.-]+)|channel\/([A-Za-z0-9_-]+)|c\/([A-Za-z0-9_-]+)|user\/([A-Za-z0-9_-]+))/);

  // Handle direct channel URL with UC... id
  if (urlMatch && urlMatch[2]) {
    const channelId = urlMatch[2];
    const ch = await youtube.channels.list({ part: ["snippet"], id: [channelId] });
    const chData = ch.data as youtube_v3.Schema$ChannelListResponse;
    const item = chData.items?.[0];
    if (item?.id) return { channelId: item.id, channelTitle: item.snippet?.title || "" };
  }

  // Handle @handle
  if (urlMatch && urlMatch[1]) {
    const handle = urlMatch[1];
    // search API for channel by handle
    const search = await youtube.search.list({ part: ["snippet"], q: `@${handle}`, type: ["channel"], maxResults: 1 });
    const searchData = search.data as youtube_v3.Schema$SearchListResponse;
    const item = searchData.items?.[0];
    const channelId = item?.snippet?.channelId;
    if (channelId) {
      return { channelId, channelTitle: item?.snippet?.channelTitle || "" };
    }
  }

  // Fallback: generic search by query string
  const search = await youtube.search.list({ part: ["snippet"], q: trimmed, type: ["channel"], maxResults: 1 });
  const searchData = search.data as youtube_v3.Schema$SearchListResponse;
  const item = searchData.items?.[0];
  const channelId = item?.snippet?.channelId;
  if (!channelId) throw new Error("Channel not found for input");
  return { channelId, channelTitle: item?.snippet?.channelTitle || "" };
}

export async function fetchLatestVideos(channelId: string, max: number = 100): Promise<BasicVideo[]> {
  const result: BasicVideo[] = [];
  let pageToken: string | undefined = undefined;
  while (result.length < max) {
    const res = await youtube.search.list({
      part: ["snippet"],
      channelId,
      order: "date",
      maxResults: 50,
      pageToken,
      type: ["video"],
    });
    const data = res.data as youtube_v3.Schema$SearchListResponse;
    for (const item of data.items || []) {
      const id = item.id?.videoId;
      const publishedAt = item.snippet?.publishedAt || new Date().toISOString();
      if (id) {
        result.push({ videoId: id, publishedAt });
      }
      if (result.length >= max) break;
    }
    pageToken = data.nextPageToken || undefined;
    if (!pageToken) break;
  }
  return result;
}

export async function fetchVideoDetails(videoIds: string[]): Promise<VideoDetails[]> {
  const batches: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) batches.push(videoIds.slice(i, i + 50));
  const details: VideoDetails[] = [];
  for (const batch of batches) {
    const res = await youtube.videos.list({ part: ["snippet", "statistics", "contentDetails"], id: batch });
    const data = res.data as youtube_v3.Schema$VideoListResponse;
    for (const v of data.items || []) {
      const stats = v.statistics;
      const snip = v.snippet;
      if (!v.id || !snip) continue;
      const thumbs = snip.thumbnails || {};
      const bestThumb = thumbs.maxres || thumbs.standard || thumbs.high || thumbs.medium || thumbs.default;
      details.push({
        videoId: v.id,
        title: snip.title || "",
        views: Number(stats?.viewCount || 0),
        likes: Number(stats?.likeCount || 0),
        comments: Number(stats?.commentCount || 0),
        thumbnailURL: bestThumb?.url || "",
        publishedAt: snip.publishedAt || new Date().toISOString(),
      });
    }
  }
  return details;
}


