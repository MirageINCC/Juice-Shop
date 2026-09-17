import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MovementStats } from "@/api/types";

const IN = "#2ee6a8";
const OUT = "#f2555f";

/** "2026-09-17" → "17.09." */
function shortDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}.${month}.`;
}

interface TooltipPayload {
  active?: boolean;
  label?: string;
  payload?: { dataKey?: string; value?: number }[];
}

function ChartTooltip({ active, label, payload }: TooltipPayload) {
  if (!active || !payload?.length || !label) return null;
  const read = (key: string) => payload.find((entry) => entry.dataKey === key)?.value ?? 0;
  return (
    <div className="rounded-lg border border-border bg-panel px-3 py-2 text-xs shadow-glass backdrop-blur-lg">
      <p className="mb-1 font-semibold">{shortDay(label)}</p>
      <p className="flex justify-between gap-4 text-brand-light">
        <span>Zugang</span>
        <span className="font-mono tabular-nums">+{read("in")}</span>
      </p>
      <p className="flex justify-between gap-4 text-destructive">
        <span>Abgang</span>
        <span className="font-mono tabular-nums">−{read("out")}</span>
      </p>
    </div>
  );
}

export function MovementChart({ stats }: { stats: MovementStats }) {
  const empty = stats.totals.in === 0 && stats.totals.out === 0;

  return (
    <div className="h-64 w-full">
      {empty ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Noch keine Buchungen in diesem Zeitraum.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.perDay} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDay}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
            />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip />} />
            <Bar dataKey="in" fill={IN} radius={[3, 3, 0, 0]} maxBarSize={18} />
            <Bar dataKey="out" fill={OUT} radius={[3, 3, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
