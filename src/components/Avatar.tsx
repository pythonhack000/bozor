const PALETTE = ["#22c55e", "#3b82f6", "#a855f7", "#f97316", "#ec4899", "#38bdf8", "#f43f5e", "#f5b93e"];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({ name, size = 40, online }: { name: string; size?: number; online?: boolean }) {
  const initials = name
    .replace(/[._-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
        style={{ backgroundColor: colorFor(name), fontSize: size * 0.4 }}
      >
        {initials}
      </span>
      {online !== undefined && (
        <span
          className={`absolute right-0 bottom-0 rounded-full ring-2 ring-surface ${
            online ? "bg-brand" : "bg-muted/50"
          }`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </span>
  );
}
