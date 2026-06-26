export interface FileUpload {
  file_id: string;
  filename: string;
  file_type: 'video' | 'srt' | 'json';
  size_bytes: number;
  path: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface SubtitleEntry {
  start: string;
  end: string;
  text: string;
}

export interface ClipData {
  clip_id: string;
  index: number;
  title: string;
  start_time: number;
  end_time: number;
  duration: number;
  score: number;
  preview_text: string;
  entries: SubtitleEntry[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  output_file: string | null;
}

export interface SubtitleStyle {
  font_name: string;
  font_size: number | null;
  bold: boolean;
  primary_color: string;
  highlight_color: string;
  outline_color: string;
  outline_width: number;
  position: string;
  margin_v: number | null;
}

export interface TitleStyle {
  font_size: number | null;
  font_color: string;
  bg_color: string;
  bg_opacity: number;
  padding: number;
  position: string;       // legacy: 'top' | 'center' | 'bottom' — deprecated in favor of position_y
  position_y?: number;    // 0-100 (% of composition height, title Y center)
  border_radius?: number; // px, corner radius of title background (default 6)
  max_chars_per_line: number | null;
}

export interface ExportSettings {
  format: string;
  width: number;
  height: number;
  codec: string;
  crf: number;
  preset: string;
  audio_bitrate: string;
}

export interface StyleConfig {
  subtitle: SubtitleStyle;
  title: TitleStyle;
  export: ExportSettings;
}

export interface MusicTrack {
  path: string;       // full file path on disk
  filename: string;   // display name
  volume: number;     // 0-1 (default 0.1)
  selected: boolean;
}

export interface LogoConfig {
  file_id: string;
  filename: string;
  x: number;        // % from left (0-100, default 50)
  y: number;        // % from top (0-100, default 85)
  size: number;     // % of width (default 15)
  opacity: number;  // 0-1 (default 1)
}

export interface Project {
  project_id: string;
  name: string;
  created_at: string;
  video_file: FileUpload | null;
  srt_file: FileUpload | null;
  json_file: FileUpload | null;
  clips: ClipData[];
  styles: StyleConfig;
  status: string;
  music_folder?: string;
  music_tracks?: MusicTrack[];
  logo_config?: LogoConfig;
}

export interface PIPBox {
  x: number;      // % of source width (0-100)
  y: number;      // % of source height (0-100)
  width: number;  // % of source width (0-100)
  height: number; // % of source height (0-100)
}

export interface PIPConfig {
  contentBox: PIPBox;
  speakerBox: PIPBox;
  splitRatio: number; // % of output height for content region (default 60)
}

export interface Template {
  template_id: string;
  name: string;
  description: string;
  styles: StyleConfig;
  layout?: 'standard' | 'pip';
  pip_config?: PIPConfig;
}

export interface ClipProgress {
  type: 'clip_progress';
  project_id: string;
  clip_id: string;
  clip_index: number;
  total_clips: number;
  percent: number;
  eta_seconds: number;
  status: string;
}

export interface ClipComplete {
  type: 'clip_complete';
  project_id: string;
  clip_id: string;
  clip_index: number;
  total_clips: number;
  output_file: string;
  size_bytes: number;
}

export interface ClipError {
  type: 'clip_error';
  project_id: string;
  clip_id: string;
  error: string;
}

export interface JobComplete {
  type: 'job_complete';
  project_id: string;
  total_created: number;
  total_failed: number;
}

export type WSMessage = ClipProgress | ClipComplete | ClipError | JobComplete;

export type TabId = 'import' | 'edit' | 'style' | 'process';

export const FORMAT_PRESETS: Record<string, { label: string; width: number; height: number; vertical: boolean }> = {
  vertical_9_16: { label: 'YouTube Shorts', width: 720, height: 1280, vertical: true },
  tiktok: { label: 'TikTok', width: 720, height: 1280, vertical: true },
  instagram_reels: { label: 'Instagram Reels', width: 1080, height: 1920, vertical: true },
  horizontal: { label: 'Horizontal', width: 1280, height: 720, vertical: false },
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  font_name: 'Arial',
  font_size: null,
  bold: true,
  primary_color: '#FFFFFF',
  highlight_color: '#FFFF00',
  outline_color: '#000000',
  outline_width: 4,
  position: 'bottom',
  margin_v: null,
};

export const DEFAULT_TITLE_STYLE: TitleStyle = {
  font_size: null,
  font_color: '#FFFFFF',
  bg_color: '#000000',
  bg_opacity: 0.75,
  padding: 20,
  position: 'top',
  position_y: 5,
  border_radius: 6,
  max_chars_per_line: null,
};

export const DEFAULT_EXPORT: ExportSettings = {
  format: 'vertical_9_16',
  width: 720,
  height: 1280,
  codec: 'libx264',
  crf: 23,
  preset: 'fast',
  audio_bitrate: '128k',
};
