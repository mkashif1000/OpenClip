import { Youtube, ExternalLink } from 'lucide-react';

export function YouTubeInput() {
  return (
    <div className="space-y-3 p-4 rounded-xl border border-border bg-panel/50">
      <div className="flex items-center gap-2">
        <Youtube className="w-4 h-4 text-red-400" />
        <h3 className="text-sm font-semibold text-text">YouTube Video</h3>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">
        Browser-side YouTube download isn't possible due to CORS restrictions.
        Download your video first using a tool like yt-dlp, then import it above.
      </p>
      <a
        href="https://github.com/yt-dlp/yt-dlp"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-accent hover:underline"
      >
        <ExternalLink className="w-3 h-3" />
        yt-dlp (free, open source downloader)
      </a>
    </div>
  );
}
