import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui/card";

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-brand-light" : tone === "negative" ? "text-destructive" : "";

  return (
    <Card className="gap-0 border-border bg-panel p-4 shadow-glass backdrop-blur-lg">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </p>
        <Icon name={icon} size={16} className="text-muted-foreground" />
      </div>
      <p className={`mt-3 font-mono text-3xl tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
