import type { CSSProperties, ReactNode } from 'react';
import { Easing, interpolate } from 'remotion';
import { ArrowDown, ArrowRight, AudioLines, Check, CheckCheck, Copy, Download, FileVideo, Headphones, MessageSquare, Play, Scissors, Upload } from 'lucide-react';

export const STORY = [
  { title: 'Start with\none recording.', description: 'The conversation. The interview. The idea worth sharing.', takeaway: 'Import a video from your device.' },
  { title: 'Every word.\nReady to use.', description: 'Give your recording a transcript. Let the good ideas surface.', takeaway: 'On-device Whisper, or your own API key.' },
  { title: 'Find the\nmoments.', description: 'Tell your AI what matters. You set the brief.', takeaway: 'Choose your clip count, length, and titles.' },
  { title: 'Your AI.\nYour choice.', description: 'Take your prompt to any LLM. Bring its answer back.', takeaway: 'Copy the prompt. Paste the response.' },
  { title: 'Make it\nfeel like you.', description: 'A little music. Your signature. A voice that stays yours.', takeaway: 'Add optional music and your logo.' },
  { title: 'One look.\nEvery clip.', description: 'Choose a template. Give the whole batch a consistent style.', takeaway: 'Preview your clips. Render in your browser.' },
  { title: 'Ready for\nyour audience.', description: 'One recording becomes a whole new set of possibilities.', takeaway: 'Download your videos. Share your story.' },
] as const;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const motionProgress = (frame: number, start: number, end: number) => interpolate(frame, [start, end], [0, 1], { ...clamp, easing: Easing.bezier(.22, 1, .36, 1) });
const linear = (frame: number, start: number, end: number) => interpolate(frame, [start, end], [0, 1], clamp);
const panel: CSSProperties = { background: 'linear-gradient(145deg, #222, #121212)', border: '1px solid #3a3a3a', borderRadius: 20, boxShadow: '0 22px 55px #0006' };
const mono: CSSProperties = { fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 };
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 };

function Reveal({ frame, at = 0, children, style }: { frame: number; at?: number; children: ReactNode; style?: CSSProperties }) {
  const progress = motionProgress(frame, at, at + 16);
  return <div style={{ opacity: progress, transform: `translateY(${(1 - progress) * 20}px)`, ...style }}>{children}</div>;
}

function Waveform({ frame, active = false }: { frame: number; active?: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 60, width: '100%' }}>{Array.from({ length: 48 }, (_, i) => {
    const height = 9 + Math.abs(Math.sin(i * 1.8) * Math.cos(i * .37)) * 43;
    return <span key={i} style={{ flex: 1, height, borderRadius: 3, background: '#aaa', opacity: active && i > (frame / 2) % 49 ? .24 : .8, transform: `scaleY(${active ? .8 + Math.sin(frame / 7 + i) * .2 : 1})` }} />;
  })}</div>;
}

/** A graphic sample recording, deliberately distinct from the real workspace UI. */
function Poster({ variant = 0, logo = false, captions = false }: { variant?: number; logo?: boolean; captions?: boolean }) {
  const words = ['MAKE\nSOMETHING\nMATTER.', 'START\nWITH\nAN IDEA.', 'FIND\nYOUR OWN\nRHYTHM.'];
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: variant === 1 ? '#dededb' : '#252525', color: variant === 1 ? '#171717' : '#fafafa' }}>
    <div style={{ position: 'absolute', width: '110%', aspectRatio: '1', left: '18%', top: '10%', borderRadius: '50%', border: `${variant === 1 ? 26 : 18}px solid ${variant === 1 ? '#c3c3bf' : '#454545'}` }} />
    <div style={{ position: 'absolute', width: '80%', aspectRatio: '1', left: '-36%', bottom: '-15%', borderRadius: '50%', border: `1px solid ${variant === 1 ? '#aaa' : '#666'}` }} />
    <div style={{ position: 'absolute', left: '10%', top: '10%', ...mono, fontSize: 10, letterSpacing: 1 }}>CREATIVE / 0{variant + 1}</div>
    <div style={{ position: 'absolute', left: '10%', right: '8%', top: '34%', whiteSpace: 'pre-line', fontSize: 26, lineHeight: 1.03, letterSpacing: -1.1, fontWeight: 800 }}>{words[variant]}</div>
    {logo && <div style={{ position: 'absolute', top: 15, right: 14, padding: '6px 7px', borderRadius: 6, background: '#f5f5f5', color: '#111', fontSize: 12, fontWeight: 850 }}>OC</div>}
    {captions && <div style={{ position: 'absolute', bottom: '12%', left: '8%', right: '8%', textAlign: 'center' }}><span style={{ padding: '5px 7px', background: '#f5f5f5', color: '#111', fontWeight: 700, fontSize: 13 }}>An idea worth sharing.</span></div>}
    <div style={{ position: 'absolute', bottom: 14, left: '10%', ...mono, fontSize: 10 }}>0{variant + 1} / OPENCLIP</div>
  </div>;
}

function ImportScene({ frame }: { frame: number }) {
  const land = motionProgress(frame, 25, 49);
  const imported = motionProgress(frame, 64, 108);
  return <>
    <div style={{ position: 'absolute', left: 37, top: 55, width: 560, height: 347, border: '1px dashed #484848', borderRadius: 26 }} />
    <div style={{ position: 'absolute', left: 74, top: 30, width: 488, height: 282, ...panel, overflow: 'hidden', transform: `translateY(${(1 - land) * -24}px) rotate(${(1 - land) * -4}deg)` }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 20%, #555, #222 65%)' }} />
      <div style={{ position: 'absolute', width: 270, height: 270, borderRadius: '50%', border: '1px solid #777', right: -35, top: -65 }} />
      <div style={{ position: 'absolute', left: 30, top: 27, ...mono, color: '#bbb' }}>ORIGINAL RECORDING</div>
      <div style={{ position: 'absolute', left: 30, top: 78, fontSize: 47, lineHeight: .98, fontWeight: 700, letterSpacing: -2 }}>Ideas worth<br />sharing.</div>
      <div style={{ position: 'absolute', left: 30, right: 30, bottom: 22, ...row, justifyContent: 'space-between' }}><span style={{ ...row, fontSize: 15 }}><Play fill="currentColor" size={14} /> creative-session.mp4</span><span style={mono}>24:18</span></div>
    </div>
    <Reveal frame={frame} at={45} style={{ position: 'absolute', left: 105, top: 327, width: 424, ...panel, padding: '17px 20px' }}>
      <div style={{ ...row, justifyContent: 'space-between', fontSize: 18 }}><span style={row}>{imported === 1 ? <Check size={22} /> : <Upload size={22} />}{imported === 1 ? 'Your recording is ready' : 'Importing your recording'}</span><span style={{ ...mono, color: '#aaa' }}>{Math.round(imported * 100)}%</span></div>
      <div style={{ height: 3, background: '#393939', marginTop: 15 }}><div style={{ height: '100%', background: '#fff', transformOrigin: 'left', transform: `scaleX(${imported})` }} /></div>
    </Reveal>
    <Reveal frame={frame} at={112} style={{ position: 'absolute', left: 184, top: 439, ...row, color: '#999', fontSize: 16 }}><FileVideo size={17} /> One source. All the possibilities.</Reveal>
  </>;
}

const transcriptLines = [
  ['00:08', 'The best ideas start with curiosity.'],
  ['00:14', 'You don’t need a perfect first draft.'],
  ['00:21', 'You just need to start creating.'],
];
function TranscriptScene({ frame, reducedMotion }: { frame: number; reducedMotion: boolean }) {
  const active = frame < 60 ? 0 : frame < 100 ? 1 : 2;
  return <>
    <Reveal frame={frame} style={{ position: 'absolute', inset: '12px 16px 20px', ...panel, padding: '25px 27px' }}>
      <div style={{ ...row, justifyContent: 'space-between', color: '#aaa', ...mono }}><span style={row}><AudioLines size={20} /> AUDIO → TEXT</span><span>TRANSCRIPT</span></div>
      <div style={{ marginTop: 24, marginBottom: 21 }}><Waveform frame={frame} active={!reducedMotion && frame < 135} /></div>
      <div style={{ height: 1, background: '#383838', marginBottom: 11 }} />
      {transcriptLines.map(([time, text], i) => <Reveal key={time} frame={frame} at={24 + i * 12} style={{ display: 'flex', alignItems: 'center', gap: 20, height: 65, borderBottom: '1px solid #ffffff0b', color: active === i ? '#fff' : '#858585' }}><span style={{ ...mono, fontSize: 14, flexShrink: 0 }}>{time}</span><span style={{ fontSize: 21, lineHeight: 1.3, letterSpacing: -.4 }}>{text}</span></Reveal>)}
      <Reveal frame={frame} at={118} style={{ ...row, marginTop: 20, fontSize: 16, color: '#ccc' }}><CheckCheck size={19} /> Every word, with timestamps.</Reveal>
    </Reveal>
  </>;
}

function PromptScene({ frame }: { frame: number }) {
  const prompt = 'Find the practical ideas.\nMake each clip worth sharing.';
  const count = Math.floor(linear(frame, 20, 76) * prompt.length);
  return <>
    <Reveal frame={frame} style={{ position: 'absolute', left: 16, right: 16, top: 26, ...panel, padding: '29px 30px 32px' }}>
      <div style={{ ...mono, color: '#999', marginBottom: 24 }}>YOUR CREATIVE BRIEF</div>
      <div style={{ minHeight: 132, fontSize: 34, lineHeight: 1.22, letterSpacing: -1.1, whiteSpace: 'pre-line' }}>{prompt.slice(0, count)}{frame < 80 && <span style={{ display: 'inline-block', width: 2, height: 30, marginLeft: 3, verticalAlign: 'middle', background: '#fff' }} />}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 21 }}>
        {['3 clips', '30–60 sec', 'Titles on'].map((label, i) => <Reveal key={label} frame={frame} at={83 + i * 4} style={{ padding: '13px 17px', border: '1px solid #555', background: '#2d2d2d', borderRadius: 10, fontSize: 19, whiteSpace: 'nowrap' }}>{label}</Reveal>)}
      </div>
    </Reveal>
    <Reveal frame={frame} at={112} style={{ position: 'absolute', left: 71, right: 71, top: 367, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#b0b0b0', fontSize: 20 }}><span>Your intent</span><div style={{ flex: 1, height: 1, background: '#444', margin: '0 20px' }} /><span style={row}><Scissors size={20} /> Your clips</span></Reveal>
  </>;
}

function LlmScene({ frame }: { frame: number }) {
  const send = motionProgress(frame, 42, 67);
  const receive = motionProgress(frame, 95, 120);
  return <>
    <Reveal frame={frame} style={{ position: 'absolute', left: 8, top: 23, width: 277, height: 272, ...panel, padding: 25 }}>
      <div style={{ ...mono, color: '#aaa', marginBottom: 22 }}>01 / OPENCLIP</div><Copy size={32} strokeWidth={1.4} />
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -.8, marginTop: 16 }}>Copy prompt</div>
      <div style={{ marginTop: 16, color: '#999', fontSize: 19, lineHeight: 1.5 }}>Your brief<br />+ your transcript</div>
    </Reveal>
    <Reveal frame={frame} at={8} style={{ position: 'absolute', right: 8, top: 23, width: 277, height: 272, borderRadius: 20, background: '#e9e9e6', color: '#181818', padding: 25 }}>
      <div style={{ ...mono, color: '#686868', marginBottom: 22 }}>02 / ANY LLM</div><MessageSquare size={32} strokeWidth={1.4} />
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -.8, marginTop: 16 }}>Ask your AI</div>
      <div style={{ marginTop: 16, color: '#666', fontSize: 19, lineHeight: 1.5 }}>Paste the prompt.<br />Copy its response.</div>
    </Reveal>
    <div style={{ position: 'absolute', left: 291, top: 142, width: 52, height: 36, display: 'grid', placeItems: 'center', opacity: send, transform: `translateX(${(1 - send) * -12}px)` }}><ArrowRight size={27} /></div>
    <Reveal frame={frame} at={95} style={{ position: 'absolute', left: 56, right: 56, top: 339, ...panel, padding: '20px 24px', ...row, justifyContent: 'space-between' }}>
      <div><div style={{ ...mono, color: '#888', marginBottom: 7 }}>03 / BACK IN OPENCLIP</div><span style={{ fontSize: 23, letterSpacing: -.5 }}>Paste the reply. Load your clips.</span></div><span style={{ opacity: receive }}><Check size={28} /></span>
    </Reveal>
    <div style={{ position: 'absolute', right: 144, top: 302, opacity: receive }}><ArrowDown size={24} color="#888" /></div>
  </>;
}

function BrandScene({ frame }: { frame: number }) {
  const brand = motionProgress(frame, 55, 72);
  return <>
    <Reveal frame={frame} style={{ position: 'absolute', left: 28, top: 8, width: 230, height: 410, borderRadius: 16, overflow: 'hidden', border: '1px solid #555', boxShadow: '0 25px 55px #0008' }}><Poster captions /><div style={{ position: 'absolute', top: 18, right: 16, background: '#eee', color: '#111', padding: '8px 9px', borderRadius: 6, fontSize: 14, fontWeight: 800, opacity: brand, transform: `scaleX(${.8 + brand * .2}) scaleY(${.8 + brand * .2})` }}>OC</div></Reveal>
    <Reveal frame={frame} at={28} style={{ position: 'absolute', right: 16, top: 43, width: 304, ...panel, padding: 23 }}>
      <div style={{ ...row, fontSize: 20 }}><Headphones size={21} /> Set the mood</div><div style={{ color: '#888', marginTop: 12, fontSize: 16 }}>Background music</div><div style={{ marginTop: 12 }}><Waveform frame={frame} /></div>
      <div style={{ ...row, marginTop: 14 }}><div style={{ height: 3, background: '#444', flex: 1 }}><div style={{ width: '28%', height: 3, background: '#eee', position: 'relative' }}><span style={{ position: 'absolute', right: -5, top: -4, width: 11, height: 11, borderRadius: '50%', background: '#fff' }} /></div></div><span style={{ ...mono, color: '#aaa' }}>20%</span></div>
    </Reveal>
    <Reveal frame={frame} at={64} style={{ position: 'absolute', right: 16, top: 296, width: 304, ...panel, padding: 23, ...row }}><span style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 10, background: '#eee', color: '#111', fontWeight: 800 }}>OC</span><div style={{ flex: 1 }}><div style={{ fontSize: 21 }}>Your signature</div><div style={{ color: '#888', fontSize: 16, marginTop: 6 }}>Logo added</div></div><Check size={21} /></Reveal>
  </>;
}

function RenderScene({ frame }: { frame: number }) {
  const selected = frame >= 47;
  const progress = linear(frame, 86, 146);
  return <>
    <div style={{ position: 'absolute', left: 20, top: 3, ...mono, color: '#999' }}>CHOOSE YOUR LOOK</div>
    {['Editorial', 'Statement', 'Minimal'].map((label, i) => <Reveal key={label} frame={frame} at={i * 4} style={{ position: 'absolute', left: 19 + i * 205, top: 42, width: 186 }}>
      <div style={{ position: 'relative', height: 274, border: `${selected && i === 1 ? 3 : 1}px solid ${selected && i === 1 ? '#eee' : '#454545'}`, borderRadius: 13, overflow: 'hidden', opacity: selected && i !== 1 ? .42 : 1 }}><Poster variant={i} captions />{selected && i === 1 && <span style={{ position: 'absolute', right: 10, top: 10, background: '#111', color: '#fff', borderRadius: '50%', width: 25, height: 25, display: 'grid', placeItems: 'center' }}><Check size={16} /></span>}</div>
      <div style={{ marginTop: 12, fontSize: 17, textAlign: 'center', color: '#aaa' }}>{label}</div>
    </Reveal>)}
    <Reveal frame={frame} at={80} style={{ position: 'absolute', top: 379, left: 19, right: 17, ...panel, padding: '17px 22px' }}><div style={{ ...row, justifyContent: 'space-between', fontSize: 19 }}><span style={row}>{progress === 1 ? <Check size={20} /> : <Scissors size={20} />}{progress === 1 ? '3 clips rendered' : 'Rendering your clips'}</span><span style={mono}>{Math.round(progress * 100)}%</span></div><div style={{ height: 3, marginTop: 13, background: '#363636' }}><div style={{ height: 3, background: '#eee', transformOrigin: 'left', transform: `scaleX(${progress})` }} /></div></Reveal>
  </>;
}

function DownloadScene({ frame }: { frame: number }) {
  const spread = motionProgress(frame, 9, 34);
  return <>
    {[0, 2, 1].map((i) => <div key={i} style={{ position: 'absolute', top: i === 1 ? 10 : 34, left: 223 + (i - 1) * 174 * spread, width: 188, height: 306, borderRadius: 14, overflow: 'hidden', border: '1px solid #666', boxShadow: '0 18px 40px #0008', transform: `rotate(${(i - 1) * 7 * spread}deg) translateY(${(1 - spread) * 15}px)` }}><Poster variant={i} logo captions /><div style={{ position: 'absolute', right: 10, bottom: 11, background: '#111b', padding: '4px 6px', borderRadius: 5, ...mono, fontSize: 12 }}>{['0:38', '0:46', '0:32'][i]}</div></div>)}
    <Reveal frame={frame} at={48} style={{ position: 'absolute', top: 354, left: 0, right: 0, textAlign: 'center' }}><div style={{ ...row, justifyContent: 'center', fontSize: 17, color: '#aaa', marginBottom: 17 }}><CheckCheck size={20} /> 3 videos. Ready to share.</div><span style={{ display: 'inline-flex', gap: 13, alignItems: 'center', background: '#f2f2ee', color: '#111', padding: '16px 27px', borderRadius: 12, fontSize: 22, fontWeight: 650 }}><Download size={23} />Download your clips</span></Reveal>
  </>;
}

export function SceneArtwork({ index, frame, reducedMotion }: { index: number; frame: number; reducedMotion: boolean }) {
  // Each reduced-motion chapter shows its finished composition immediately.
  const time = reducedMotion ? 160 : frame;
  const scenes = [<ImportScene frame={time} />, <TranscriptScene frame={time} reducedMotion={reducedMotion} />, <PromptScene frame={time} />, <LlmScene frame={time} />, <BrandScene frame={time} />, <RenderScene frame={time} />, <DownloadScene frame={time} />];
  return <div data-artwork={index} style={{ position: 'absolute', inset: 0 }}>{scenes[index]}</div>;
}
