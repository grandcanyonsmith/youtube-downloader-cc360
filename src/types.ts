export type ProgressEvent = {
  type: "info" | "progress" | "error" | "done";
  message?: string;
  current?: number;
  total?: number;
  jobId?: string;
};

export type VideoRecord = {
  id: string;
  videoId: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  thumbnailURL: string;
  transcript?: string | null;
  publishedAt: string;
  scrapedAt: string;
};


