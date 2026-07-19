import { memo } from "react";
import { getScenarioById } from "@/lib/fixtures/scenarios";
import type { LiveCellResult } from "@/lib/live-types";

/* One cell of the live wall — memoised so a 10,000-cell grid only
 * re-renders the cells whose state changed. */

export type CellState = "pending" | "running" | LiveCellResult["outcome"];

const cellStyles: Record<CellState, string> = {
  pending: "bg-raised/60",
  running: "bg-accent/35 animate-pulse-cell",
  pass: "bg-accent/12 text-accent [animation:settle-in_.35s_var(--ease-out-quad)_both]",
  fail: "bg-fail/18 text-fail [animation:fail-pop_.6s_var(--ease-out-quad)_both]",
  partial: "bg-warn/15 text-warn [animation:settle-in_.35s_var(--ease-out-quad)_both]",
  error:
    "bg-warn/10 text-warn ring-1 ring-inset ring-warn/40 [animation:settle-in_.35s_var(--ease-out-quad)_both]",
};

const cellGlyph: Record<string, string> = { pass: "✓", fail: "✗", partial: "◐", error: "!" };

export const WallCell = memo(function WallCell({
  scenarioId,
  name,
  state,
  cellPx,
  showGlyph,
  onOpen,
}: {
  scenarioId: string;
  name?: string;
  state: CellState;
  cellPx: number;
  showGlyph: boolean;
  onOpen: (scenarioId: string) => void;
}) {
  const resolved = state !== "pending" && state !== "running";
  const radius = cellPx >= 16 ? 5 : 2;
  const body = (
    <span
      className={`flex items-center justify-center leading-none transition-colors duration-300 ${cellStyles[state]} ${
        resolved ? "cursor-pointer hover:ring-1 hover:ring-mut" : ""
      }`}
      style={{
        width: cellPx,
        height: cellPx,
        borderRadius: radius,
        fontSize: Math.floor(cellPx * 0.45),
      }}
    >
      {resolved && showGlyph ? cellGlyph[state] : null}
    </span>
  );
  const title = `${scenarioId} · ${name ?? getScenarioById(scenarioId)?.name ?? ""} · ${state}`;
  if (!resolved) return <div title={title}>{body}</div>;
  return (
    <button
      title={title}
      onClick={() => onOpen(scenarioId)}
      className="focus-ring"
      style={{ borderRadius: radius }}
    >
      {body}
    </button>
  );
});
