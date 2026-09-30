import { useRef, useState } from 'react';

export function useEditorHistory<T>(initial: T) {
  const [history, setHistory] = useState({ past: [] as T[], present: initial, future: [] as T[] });
  const gesture = useRef({ key: '', time: 0 });
  const update = (fn: (current: T) => T, key = 'edit') => {
    const now = Date.now();
    const group = gesture.current.key === key && now - gesture.current.time < 400;
    gesture.current = { key, time: now };
    setHistory((h) => ({ past: group ? h.past : [...h.past, h.present].slice(-60), present: fn(h.present), future: [] }));
  };
  const undo = () => { gesture.current.key = ''; setHistory((h) => h.past.length ? {
    past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future],
  } : h); };
  const redo = () => { gesture.current.key = ''; setHistory((h) => h.future.length ? {
    past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1),
  } : h); };
  return { draft: history.present, update, undo, redo, canUndo: !!history.past.length, canRedo: !!history.future.length };
}
