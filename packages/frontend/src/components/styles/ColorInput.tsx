interface ColorInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function ColorInput({ label, value, onChange }: ColorInputProps) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent shrink-0 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2.5 py-2 rounded-lg bg-input border border-border text-text text-xs font-mono focus:outline-none focus:border-accent uppercase"
        />
      </div>
    </div>
  );
}
