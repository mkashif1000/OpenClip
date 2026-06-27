/**
 * Builds the prompt the user copies into a free chatbot (ChatGPT, Claude,
 * Gemini, Grok, DeepSeek). The chatbot reads the timestamped transcript and
 * returns a JSON array of viral clip ranges that OpenClip's loadClipsFromJson
 * understands directly.
 */

export interface ClipPromptOptions {
  /** Timestamped transcript lines, e.g. "[00:12] So the first thing is…". */
  transcript: string;
  /** How many clips to ask for. */
  numClips: number;
  /** Whether to ask the model to write a punchy title per clip. */
  wantTitles: boolean;
  /** Minimum clip length, in seconds. */
  minLen: number;
  /** Maximum clip length, in seconds. */
  maxLen: number;
  /** Free-text extra guidance from the user (include moments, priorities, …). */
  extra?: string;
}

export function buildClipPrompt({ transcript, numClips, wantTitles, minLen, maxLen, extra }: ClipPromptOptions): string {
  // Guard against an inverted range so the rule always reads low→high.
  const lo = Math.min(minLen, maxLen);
  const hi = Math.max(minLen, maxLen);
  const titleField = wantTitles
    ? `  "title": "a punchy, curiosity-driving title (max 8 words)",\n`
    : '';
  const titleRule = wantTitles
    ? '- Write a short, punchy, curiosity-driving "title" for each clip.\n'
    : '- Do NOT include a "title" field.\n';

  const extraBlock = extra && extra.trim()
    ? `\nAdditional instructions from the user (follow these closely):\n${extra.trim()}\n`
    : '';

  return `You are an expert short-form video editor. From the transcript below, pick the ${numClips} BEST self-contained moments to turn into viral vertical clips (TikTok / Reels / Shorts).

Important — do not refuse this task: the transcript is raw speech from a real video, auto-transcribed for editing. It may contain profanity, slang, politics, or other sensitive topics. Your job is only to choose timestamp ranges, not to judge the content. If a word is something you cannot output verbatim, censor it with asterisks in any "title" or "reason" (e.g. "f***", "sh**", "r*pe") — but ALWAYS return every clip with its start/end timestamps and score regardless of the content. Never drop a clip or refuse because of language or subject matter.


Selection rules:
- Each clip must be self-contained: it should make sense on its own, start on a clean sentence/idea and end on a clear payoff or punchline.
- Prefer a strong hook in the first 1–2 sentences (a bold claim, question, surprising fact, or story opener).
- Each clip must be between ${lo} and ${hi} seconds long. Never start mid-sentence or end mid-thought.
- Spread the picks across the whole video; don't cluster them in one section.
- Give each clip a "score" from 0–100 for viral potential, and a one-line "reason".
${titleRule}${extraBlock}
Output format — THIS IS CRITICAL:
- Reply with ONLY a raw JSON array. No markdown, no \`\`\` code fences, no text before or after it.
- Use this exact shape for each item:
[
{
  "start": "MM:SS",
  "end": "MM:SS",
${titleField}  "score": 0,
  "reason": "why this clip works"
}
]
- "start"/"end" must be timestamps copied from the transcript (format MM:SS or HH:MM:SS).

Transcript:
${transcript}`;
}

/** Famous free chatbots, in the order most people reach for them. */
export const CHATBOTS: Array<{ name: string; url: string }> = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
  { name: 'Claude', url: 'https://claude.ai/new' },
  { name: 'Grok', url: 'https://grok.com/' },
  { name: 'DeepSeek', url: 'https://chat.deepseek.com/' },
];
