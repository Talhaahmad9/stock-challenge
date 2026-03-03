"use client";

interface Props {
  size?: "sm" | "md";
}

/**
 * Cyberpunk digital-signal spinner.
 * Three bars that pulse in sequence — like a signal waveform.
 */
export default function Spinner({ size = "md" }: Props) {
  const bar = size === "sm" ? "w-0.5" : "w-1";
  const heights = size === "sm" ? ["h-2", "h-3", "h-2"] : ["h-3", "h-5", "h-3"];

  return (
    <span className="inline-flex items-end gap-0.5" aria-label="Loading">
      {heights.map((h, i) => (
        <span
          key={i}
          className={`${bar} ${h} bg-current rounded-sm animate-pulse`}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
