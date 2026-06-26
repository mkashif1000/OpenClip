import React from 'react';

interface TitleOverlayProps {
  title: string;
  fontSize?: number;
  fontColor?: string;
  bgColor?: string;
  bgOpacity?: number;
  padding?: number;
  position?: 'top' | 'center' | 'bottom';
  positionY?: number; // 0-100, % of composition height (Y center of title)
  borderRadius?: number;
  maxCharsPerLine?: number;
  fontName?: string;
  /** Tier-1 / tier-2 word colors (multi-color titles). */
  highlightColor?: string;
  accentColor?: string;
  /** Per-word color tier (0/1/2), aligned to whitespace words of `title`. */
  wordColors?: number[];
}

type Word = { text: string; tier: number };

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  title,
  fontSize = 32,
  fontColor = '#FFFFFF',
  bgColor = '#000000',
  bgOpacity = 0.75,
  padding = 20,
  position = 'top',
  positionY,
  borderRadius = 6,
  maxCharsPerLine = 25,
  fontName,
  highlightColor = '#FFD23F',
  accentColor = '#FF4D4D',
  wordColors,
}) => {
  if (!title) return null;

  const rawWords = title.trim().split(/\s+/).filter(Boolean);
  const words: Word[] = rawWords.map((t, i) => ({ text: t, tier: wordColors?.[i] ?? 0 }));
  const lines = wrapWords(words, maxCharsPerLine);

  let yStyle: React.CSSProperties;
  if (typeof positionY === 'number') {
    yStyle = { top: `${positionY}%`, transform: 'translateY(-50%)' };
  } else if (position === 'center') {
    yStyle = { top: '50%', transform: 'translateY(-50%)' };
  } else if (position === 'bottom') {
    yStyle = { bottom: padding };
  } else {
    yStyle = { top: padding };
  }

  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    ...yStyle,
  };

  const r = parseInt(bgColor.slice(1, 3), 16) || 0;
  const g = parseInt(bgColor.slice(3, 5), 16) || 0;
  const b = parseInt(bgColor.slice(5, 7), 16) || 0;
  const transparent = bgOpacity <= 0.001;

  const tierColor = (tier: number) => (tier === 1 ? highlightColor : tier === 2 ? accentColor : fontColor);

  return (
    <div style={positionStyle}>
      <div
        style={{
          backgroundColor: transparent ? 'transparent' : `rgba(${r}, ${g}, ${b}, ${bgOpacity})`,
          padding: `${padding * 0.6}px ${padding * 1.2}px`,
          borderRadius,
          textAlign: 'center',
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: fontName ? `${fontName}, Arial, Helvetica, sans-serif` : 'Arial, Helvetica, sans-serif',
              fontSize,
              fontWeight: 'bold',
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              // Shadow keeps light words legible over bright video when there's
              // no background box.
              textShadow: transparent ? '0 2px 6px rgba(0,0,0,0.85)' : 'none',
            }}
          >
            {line.map((w, j) => (
              <span key={j} style={{ color: tierColor(w.tier) }}>
                {w.text}{j < line.length - 1 ? ' ' : ''}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

function wrapWords(words: Word[], maxChars: number): Word[][] {
  const lines: Word[][] = [];
  let cur: Word[] = [];
  let len = 0;
  for (const w of words) {
    const add = (cur.length ? 1 : 0) + w.text.length;
    if (cur.length && len + add > maxChars) {
      lines.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(w);
    len += (cur.length > 1 ? 1 : 0) + w.text.length;
  }
  if (cur.length) lines.push(cur);
  return lines;
}
