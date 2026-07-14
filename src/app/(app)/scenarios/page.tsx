"use client";

import { useMemo, useState } from "react";
import { Button, Eyebrow, SeverityLabel } from "@/components/ui";
import { demoOutcomes, getSuite } from "@/lib/fixtures/scenarios";
import { LIBRARY_SIZES } from "@/lib/suite-tiers";
import { useLibrarySize } from "@/lib/library-size";
import type { Scenario, Severity } from "@/lib/types";
import { useMode } from "@/lib/mode";
import { LiveEmpty } from "@/components/live-empty";

const PAGE_SIZE = 100;

export default function ScenariosPage() {
  const { mode } = useMode();
  const { size: librarySize, setSize: setLibrarySize } = useLibrarySize();
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [creating, setCreating] = useState(false);
  const [drafts, setDrafts] = useState<Scenario[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const all = useMemo(() => [...drafts, ...getSuite(librarySize)], [drafts, librarySize]);
  const cats = useMemo(() => [...new Set(all.map((s) => s.category))], [all]);
  const filtered = useMemo(
    () => (filter ? all.filter((s) => s.category === filter) : all),
    [all, filter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (mode === "live") return <LiveEmpty surface="the scenario library" />;

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">
            Scenarios
          </h1>
          <p className="mt-2 text-sm text-sub">
            {all.length.toLocaleString()} scenarios · Ecommerce Support Suite v2
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>New scenario</Button>
      </div>

      {/* Library size — the first 200 are the hand-shaped base suite;
          larger sizes extend it deterministically, up to 10,000. */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Eyebrow className="mr-2">Library size</Eyebrow>
        {LIBRARY_SIZES.map((n) => (
          <button
            key={n}
            onClick={() => {
              setLibrarySize(n);
              setPage(0);
            }}
            className={`focus-ring h-8 rounded-md border px-3 font-mono text-[12px] tabular-nums transition-colors duration-150 cursor-pointer ${
              librarySize === n
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-edge text-sub hover:border-mut hover:text-ink"
            }`}
          >
            {n.toLocaleString()}
          </button>
        ))}
        <span className="ml-2 text-[12px] text-mut">
          sizes past 200 extend the base suite deterministically
        </span>
      </div>

      {/* Category filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip
          label="All"
          active={filter === null}
          onClick={() => {
            setFilter(null);
            setPage(0);
          }}
        />
        {cats.map((c) => (
          <FilterChip
            key={c}
            label={c}
            active={filter === c}
            onClick={() => {
              setFilter(filter === c ? null : c);
              setPage(0);
            }}
          />
        ))}
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-edge">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-edge bg-surface font-mono text-[10px] uppercase tracking-wider text-mut">
              <th className="h-10 px-4 font-medium">ID</th>
              <th className="h-10 px-4 font-medium">Scenario</th>
              <th className="h-10 px-4 font-medium">Category</th>
              <th className="h-10 px-4 font-medium">Severity</th>
              <th className="hidden h-10 px-4 font-medium xl:table-cell">
                Correct outcome
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                onClick={() => setSelected(s)}
                className="h-12 cursor-pointer border-b border-edge/60 transition-colors last:border-0 hover:bg-surface"
              >
                <td className="px-4 font-mono text-[12px] text-mut">{s.id}</td>
                <td className="max-w-64 truncate px-4 text-ink">{s.name}</td>
                <td className="px-4 text-sub">{s.category}</td>
                <td className="px-4">
                  <SeverityLabel severity={s.severity} />
                </td>
                <td className="hidden max-w-96 truncate px-4 text-sub xl:table-cell">
                  {s.rubric}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px]">
          <span className="font-mono text-[12px] tabular-nums text-mut">
            {(safePage * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min(filtered.length, (safePage + 1) * PAGE_SIZE).toLocaleString()} of{" "}
            {filtered.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              ← Prev
            </Button>
            <span className="font-mono text-[12px] tabular-nums text-mut">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <Drawer onClose={() => setSelected(null)} title={selected.name}>
          <ScenarioDetail
            scenario={selected}
            outcome={demoOutcomes.get(selected.id)}
          />
        </Drawer>
      )}

      {creating && (
        <Drawer onClose={() => setCreating(false)} title="New scenario">
          <NewScenarioForm
            nextIndex={all.length + 1}
            onCreate={(s) => {
              setDrafts((d) => [s, ...d]);
              setCreating(false);
              setSelected(s);
            }}
          />
        </Drawer>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring h-8 rounded-full border px-3.5 text-[12px] transition-colors duration-150 cursor-pointer ${
        active
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-edge text-sub hover:border-mut hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal>
      <div
        className="animate-fade-in absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="animate-fade-up absolute inset-y-0 right-0 w-full max-w-lg overflow-y-auto border-l border-edge bg-raised p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-medium text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="focus-ring rounded-md p-1 text-mut transition-colors hover:text-ink cursor-pointer"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}

function ScenarioDetail({
  scenario,
  outcome,
}: {
  scenario: Scenario;
  outcome?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 font-mono text-[12px] text-mut">
        {scenario.id} · {scenario.category}
        <SeverityLabel severity={scenario.severity} />
        {outcome && (
          <a
            href={`/replay/${scenario.id}`}
            className="focus-ring rounded text-accent hover:underline"
          >
            last replay →
          </a>
        )}
      </div>
      <Field label="Correct outcome">{scenario.rubric}</Field>
      <Field label="Customer persona">{scenario.persona}</Field>
      <Field label="Opening message">
        <p className="rounded-lg border border-edge bg-surface p-4 text-sub">
          “{scenario.openingMessage}”
        </p>
      </Field>
      <Field label="Hidden facts">
        <ul className="list-inside space-y-1.5 text-sub">
          {scenario.hiddenFacts.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      </Field>
      <Field label="Pass criteria">
        <ul className="space-y-1.5">
          {scenario.passCriteria.map((c) => (
            <li key={c} className="flex gap-2 text-sub">
              <span aria-hidden className="font-mono text-accent">✓</span>
              {c}
            </li>
          ))}
        </ul>
      </Field>
      <Field label="Must not">
        <ul className="space-y-1.5">
          {scenario.mustNot.map((c) => (
            <li key={c} className="flex gap-2 text-sub">
              <span aria-hidden className="font-mono text-mut">⊘</span>
              {c}
            </li>
          ))}
        </ul>
      </Field>
    </div>
  );
}

const inputCls =
  "focus-ring w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-mut transition-shadow duration-200 focus:border-accent/50 " +
  "focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] outline-none";

function NewScenarioForm({
  nextIndex,
  onCreate,
}: {
  nextIndex: number;
  onCreate: (s: Scenario) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    category: "Refund fraud",
    severity: "high" as Severity,
    rubric: "",
    persona: "",
    openingMessage: "",
    hiddenFacts: "",
    passCriteria: "",
    mustNot: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({
          id: `SCN-${String(nextIndex).padStart(4, "0")}`,
          name: form.name || "Untitled scenario",
          category: form.category,
          severity: form.severity,
          rubric: form.rubric,
          persona: form.persona,
          openingMessage: form.openingMessage,
          hiddenFacts: lines(form.hiddenFacts),
          passCriteria: lines(form.passCriteria),
          mustNot: lines(form.mustNot),
        });
      }}
    >
      <label className="block space-y-2">
        <Eyebrow>Name</Eyebrow>
        <input className={inputCls} value={form.name} onChange={set("name")} placeholder="Refund demanded for a gift card purchase" required />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block space-y-2">
          <Eyebrow>Category</Eyebrow>
          <input className={inputCls} value={form.category} onChange={set("category")} />
        </label>
        <label className="block space-y-2">
          <Eyebrow>Severity</Eyebrow>
          <select className={inputCls} value={form.severity} onChange={set("severity")}>
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
      </div>
      <label className="block space-y-2">
        <Eyebrow>Correct outcome (one line)</Eyebrow>
        <input className={inputCls} value={form.rubric} onChange={set("rubric")} required />
      </label>
      <label className="block space-y-2">
        <Eyebrow>Customer persona</Eyebrow>
        <input className={inputCls} value={form.persona} onChange={set("persona")} />
      </label>
      <label className="block space-y-2">
        <Eyebrow>Opening message</Eyebrow>
        <textarea className={inputCls} rows={2} value={form.openingMessage} onChange={set("openingMessage")} />
      </label>
      <label className="block space-y-2">
        <Eyebrow>Hidden facts (one per line)</Eyebrow>
        <textarea className={inputCls} rows={2} value={form.hiddenFacts} onChange={set("hiddenFacts")} />
      </label>
      <label className="block space-y-2">
        <Eyebrow>Pass criteria (one per line)</Eyebrow>
        <textarea className={inputCls} rows={3} value={form.passCriteria} onChange={set("passCriteria")} />
      </label>
      <label className="block space-y-2">
        <Eyebrow>Must not (one per line)</Eyebrow>
        <textarea className={inputCls} rows={2} value={form.mustNot} onChange={set("mustNot")} />
      </label>
      <div className="pt-2">
        <Button type="submit" className="w-full">
          Add to suite
        </Button>
      </div>
    </form>
  );
}
