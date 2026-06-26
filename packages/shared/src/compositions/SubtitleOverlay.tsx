import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

interface SubtitleEntry {
  start: string;
  end: string;
  text: string;
}

interface SubtitleOverlayProps {
  entries: SubtitleEntry[];
  clipStartSec: number;
  primaryColor?: string;
  highlightColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  fontSize?: number;
  fontName?: string;
  bold?: boolean;
  marginV?: number;
  /** Caption look: karaoke (default) | pop | box | minimal — mirrors the export renderer. */
  preset?: string;
}

function timeToSec(t: string): number {
  const clean = t.replace(',', '.').trim();
  const parts = clean.split(':');
  if (parts.length === 3) return +parts[0] * 3600 + +parts[1] * 60 + +parts[2];
  if (parts.length === 2) return +parts[0] * 60 + +parts[1];
  return 0;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  entries,
  clipStartSec,
  primaryColor = '#FFFFFF',
  highlightColor = '#FFFF00',
  outlineColor = '#000000',
  outlineWidth = 4,
  fontSize = 62,
  fontName = 'Arial',
  bold = true,
  marginV = 120,
  preset = 'karaoke',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Find active subtitle entry
  let activeEntry: SubtitleEntry | null = null;
  for (const entry of entries) {
    const entryStart = timeToSec(entry.start) - clipStartSec;
    const entryEnd = timeToSec(entry.end) - clipStartSec;
    if (currentTime >= entryStart - 0.05 && currentTime <= entryEnd + 0.05) {
      activeEntry = entry;
      break;
    }
  }

  if (!activeEntry) return null;

  const entryStart = Math.max(timeToSec(activeEntry.start) - clipStartSec, 0);
  const entryEnd = Math.max(timeToSec(activeEntry.end) - clipStartSec, 0);
  const dur = entryEnd - entryStart;
  if (dur <= 0) return null;

  const text = activeEntry.text.trim();
  const words = text.split(/\s+/);
  if (!words.length) return null;

  // Calculate per-word time slots (proportional to character length)
  const totalChars = words.reduce((sum, w) => sum + Math.max(w.length, 1), 0);
  const wordSlots: Array<{ start: number; end: number }> = [];
  let t = entryStart;
  for (const word of words) {
    const wDur = Math.max(0.04, (word.length / totalChars) * dur);
    wordSlots.push({ start: t, end: t + wDur });
    t += wDur;
  }

  // Find active word index
  let activeIdx = -1;
  for (let i = 0; i < wordSlots.length; i++) {
    if (currentTime >= wordSlots[i].start && currentTime < wordSlots[i].end) {
      activeIdx = i;
      break;
    }
  }
  // If past all slots, highlight last word
  if (activeIdx === -1 && currentTime >= wordSlots[wordSlots.length - 1]?.start) {
    activeIdx = wordSlots.length - 1;
  }

  const ow = outlineWidth;
  const textShadow = [
    `${-ow}px ${-ow}px 0 ${outlineColor}`,
    `${ow}px ${-ow}px 0 ${outlineColor}`,
    `${-ow}px ${ow}px 0 ${outlineColor}`,
    `${ow}px ${ow}px 0 ${outlineColor}`,
    `0 ${-ow}px 0 ${outlineColor}`,
    `0 ${ow}px 0 ${outlineColor}`,
    `${-ow}px 0 0 ${outlineColor}`,
    `${ow}px 0 0 ${outlineColor}`,
  ].join(', ');

  const wordStyle = (isActive: boolean): React.CSSProperties => {
    switch (preset) {
      case 'pop':
        return {
          color: isActive ? highlightColor : primaryColor,
          fontSize: isActive ? '1.18em' : undefined,
        };
      case 'box':
        return isActive
          ? {
              color: '#FFFFFF',
              backgroundColor: highlightColor,
              borderRadius: 6,
              padding: '0 0.18em',
              textShadow: 'none',
            }
          : { color: primaryColor };
      case 'minimal':
        return { color: primaryColor };
      default: // karaoke
        return { color: isActive ? highlightColor : primaryColor };
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: marginV,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          fontFamily: `${fontName}, Arial, sans-serif`,
          fontSize,
          fontWeight: bold ? 'bold' : 'normal',
          textTransform: 'uppercase',
          lineHeight: 1.3,
          textShadow: preset === 'minimal' ? 'none' : textShadow,
          maxWidth: '100%',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          ...(preset === 'minimal'
            ? { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '0.18em 0.45em' }
            : {}),
        }}
      >
        {words.map((word, i) => (
          <span key={i} style={wordStyle(i === activeIdx)}>
            {word}{i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
};
