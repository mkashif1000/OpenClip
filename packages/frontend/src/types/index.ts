export interface FileUpload {
  file_id: string;
  filename: string;
  file_type: 'video' | 'srt' | 'json';
  size_bytes: number;
  path: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export interface SubtitleEntry {
  start: string;
  end: string;
  text: string;
}

/** A B-roll insert added by the user in the Edit tab. */
export interface ClipBroll {
  id: string;
  /** Absolute source seconds where the B-roll begins. */
  startSec: number;
  /** Absolute source seconds where the B-roll ends. */
  endSec: number;
  /** OPFS file id of the uploaded video. */
  fileId: string;
  /** Display label (filename, query, etc.). */
  label?: string;
}

/** Per-clip user edits made in the Edit tab. Stored on the clip itself. */
export interface ClipEdits {
  /**
   * Absolute source-time ranges to cut from the final render — produced when
   * the user disables words in the transcript editor. Combined with auto
   * silence/filler removal when both are active.
   */
  cutRanges?: Array<{ start: number; end: number }>;
  /** Optional title override (renders instead of clip.title). */
  customTitle?: string;
  /** Title font family override (e.g. "Inter", "Arial", "Impact"). */
  titleFont?: string;
  /** User-curated B-roll plan; overrides the auto-planner when present. */
  brolls?: ClipBroll[];
  /** Layout override (currently 'standard' or 'pip'; split-screen TBD). */
  layout?: 'standard' | 'pip' | 'gameplay' | 'split-2v' | 'split-2h' | 'split-3' | 'split-4' | 'boxed';
  /**
   * Per-clip PIP configuration (saved when the user edits PIP boxes inline
   * on the Edit-tab preview). Renderer reads this when layout === 'pip'.
   */
  pipConfig?: PIPConfig;
  /**
   * Source crop boxes for each region of the current layout. One entry per
   * region in the order returned by getSplitRegions(layout). Coordinates are
   * normalized to the source video [0,1] (x, y, w, h). Box aspect ratio is
   * locked at edit time to match its output region's aspect.
   * Used by split-2v / split-3 / split-4 / gameplay (and PIP if present).
   */
  regionCrops?: Array<{ x: number; y: number; w: number; h: number }>;
  /**
   * Per-word color tier for the title (multi-color titles). One entry per
   * whitespace-separated word of the active title text:
   *   0 = base (title.font_color), 1 = title.highlight_color, 2 = title.accent_color.
   * Auto-generated when a template is applied; editable in the Edit tab.
   */
  titleColors?: number[];
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
  /** Per-clip user edits from the Edit tab (transcript cuts, title, B-roll). */
  edits?: ClipEdits;
}

/** Caption look presets — implemented identically in the Remotion preview and the canvas export renderer. */
export type CaptionPreset = 'karaoke' | 'pop' | 'box' | 'minimal';

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
  preset?: CaptionPreset;
}

export interface TitleStyle {
  font_size: number | null;
  font_color: string;
  bg_color: string;
  bg_opacity: number;
  padding: number;
  position: string;
  position_y?: number;
  border_radius?: number;
  max_chars_per_line: number | null;
  /** Optional font family. Per-clip overrides (clip.edits.titleFont) shadow this. */
  font_name?: string;
  /** Highlight color for tier-1 title words (multi-color titles). */
  highlight_color?: string;
  /** Accent color for tier-2 title words (multi-color titles). */
  accent_color?: string;
}

export interface ExportSettings {
  format: string;
  width: number;
  height: number;
  codec: string;
  crf: number;
  preset: string;
  audio_bitrate: string;
  /** Cut silences and filler words at render time (requires Whisper word timestamps). */
  remove_silences?: boolean;
  /** Keep the speaker centered via on-device face tracking. */
  face_tracking?: boolean;
  /** Overlay relevant stock B-roll (requires a transcript + a Pexels/Pixabay key). */
  broll?: boolean;
  /** Corner radius (output px) of the inset video in the 'boxed' layout. */
  box_radius?: number;
}

export interface StyleConfig {
  subtitle: SubtitleStyle;
  title: TitleStyle;
  export: ExportSettings;
}

export interface MusicTrack {
  path: string;
  filename: string;
  volume: number;
  selected: boolean;
}

export interface LogoConfig {
  file_id: string;
  filename: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
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
  /** OPFS id of the word-level timestamp JSON produced by Whisper (enables silence/filler removal). */
  whisper_words?: string | null;
}

export interface PIPBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PIPConfig {
  contentBox: PIPBox;
  speakerBox: PIPBox;
  splitRatio: number;
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

export type TabId = 'dashboard' | 'import' | 'edit' | 'style' | 'process';

export const FORMAT_PRESETS: Record<string, { label: string; width: number; height: number; vertical: boolean }> = {
  // width/height are preview placeholders — the render derives real dimensions
  // from the source video (no quality loss), capped at 1080p-class.
  match_source: { label: 'Match Source (Best)', width: 720, height: 1280, vertical: true },
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
  preset: 'karaoke',
};

export const CAPTION_PRESETS: Record<CaptionPreset, { label: string; description: string }> = {
  karaoke: { label: 'Karaoke', description: 'Active word changes color' },
  pop: { label: 'Word Pop', description: 'Active word pops bigger' },
  box: { label: 'Highlight Box', description: 'Active word on a color pill' },
  minimal: { label: 'Minimal Bar', description: 'Clean text on a dark bar' },
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
  font_name: 'Inter',
  highlight_color: '#FFD23F',
  accent_color: '#FF4D4D',
};

export const DEFAULT_EXPORT: ExportSettings = {
  format: 'match_source',
  width: 720,
  height: 1280,
  codec: 'libx264',
  crf: 23,
  preset: 'fast',
  audio_bitrate: '128k',
  remove_silences: false,
  face_tracking: true,
  broll: false,
  box_radius: 40,
};
