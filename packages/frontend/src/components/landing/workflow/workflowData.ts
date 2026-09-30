export const WORKFLOW_FPS = 30;
export const WORKFLOW_STEP_FRAMES = 180;
// A chapter selection previews its complete story; Play starts that chapter over.
export const WORKFLOW_CHAPTER_PREVIEW_FRAME = 150;

export const WORKFLOW_STEPS = [
  {
    id: 'import',
    title: 'Import your video',
    shortTitle: 'Import',
    description: 'Choose a podcast, interview, or long-form video from your device to start a project.',
    detail: 'Start with your original recording. No need to cut it into smaller files first.',
  },
  {
    id: 'transcript',
    title: 'Get the transcript',
    shortTitle: 'Transcribe',
    description: 'Transcribe locally with Whisper, or choose API transcription with your own key.',
    detail: 'Local transcription stays on your device. API transcription sends audio to the selected provider.',
  },
  {
    id: 'prompt',
    title: 'Describe your clips',
    shortTitle: 'Describe',
    description: 'Prompt the type of moments you want. Set the number of clips, duration, and titles on or off.',
    detail: 'For example: “Find three practical, high-energy moments, 30–60 seconds each, with titles.”',
  },
  {
    id: 'llm',
    title: 'Use your favorite LLM',
    shortTitle: 'Copy & paste',
    description: 'Copy the prompt, give it to any LLM, then copy its response and paste it back into OpenClip.',
    detail: 'Your copied prompt includes the transcript. Only share it with an AI provider you trust.',
  },
  {
    id: 'brand',
    title: 'Add music & your logo',
    shortTitle: 'Make it yours',
    description: 'Select background music and a logo to give your clips a consistent identity.',
    detail: 'Music and branding are optional. Keep the original audio clear and make the clips feel like you.',
  },
  {
    id: 'render',
    title: 'Choose a template & render',
    shortTitle: 'Style & render',
    description: 'Select a template, apply the look to your clips, and start rendering.',
    detail: 'Preview your captions and layout, then render the batch locally in your browser.',
  },
  {
    id: 'download',
    title: 'Download your videos',
    shortTitle: 'Download',
    description: 'Download the finished videos once rendering completes. Your clips are ready to share.',
    detail: 'Save the rendered files to your device and publish them wherever your audience watches.',
  },
] as const;

export const WORKFLOW_DURATION = WORKFLOW_STEP_FRAMES * WORKFLOW_STEPS.length;

export function workflowStepAtFrame(frame: number) {
  return Math.min(WORKFLOW_STEPS.length - 1, Math.max(0, Math.floor(frame / WORKFLOW_STEP_FRAMES)));
}

export function workflowTime(frame: number) {
  const seconds = Math.floor(frame / WORKFLOW_FPS);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
