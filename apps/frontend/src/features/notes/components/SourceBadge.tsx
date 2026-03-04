import { cn } from "@/lib/utils";

const SOURCE_BADGE_STYLES: Record<string, string> = {
  human: "border-[#d9e6ff] bg-[#eef4ff] text-[#2f5ea8]",
  chire: "border-[#eadcff] bg-[#f6f0ff] text-[#6f42b1]",
};

type SourceBadgeProps = {
  source?: string | null;
  className?: string;
};

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const normalizedSource = (source || "human").toLowerCase();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize tracking-[0.02em]",
        SOURCE_BADGE_STYLES[normalizedSource] ?? "border-[#e3e3e1] bg-[#f3f3f1] text-[#6f6f6d]",
        className,
      )}
    >
      {normalizedSource}
    </span>
  );
}
