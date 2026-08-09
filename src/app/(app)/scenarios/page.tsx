"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, DifficultyLabel, Eyebrow, SeverityLabel } from "@/components/ui";
import { ScenarioDetail } from "@/components/scenario-detail";
import { demoOutcomes, getSuite } from "@/lib/fixtures/scenarios";
import { LIBRARY_SIZES } from "@/lib/suite-tiers";
import { useLibrarySize } from "@/lib/library-size";
import { DIFFICULTY_LABELS, type Difficulty, type Scenario, type Severity } from "@/lib/types";
import { useMode } from "@/lib/mode";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { LiveEmpty } from "@/components/live-empty";
import styles from "@/components/evidence-browser.module.css";

const PAGE_SIZE = 100;

export default function ScenariosPage() {
  const { mode } = useMode();
  const { size: librarySize, setSize: setLibrarySize } = useLibrarySize();
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [creating, setCreating] = useState(false);
  const [drafts, setDrafts] = useState<Scenario[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [page, setPage] = useState(0);

  const all = useMemo(() => [...drafts, ...getSuite(librarySize)], [drafts, librarySize]);
  const cats = useMemo(() => [...new Set(all.map((s) => s.category))], [all]);
  const filtered = useMemo(
    () =>
      all.filter(
        (s) =>
          (!filter || s.category === filter) &&
          (!difficulty || s.difficulty === difficulty),
      ),
    [all, filter, difficulty],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (mode === "live") return <LiveEmpty surface="the scenario library" />;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.kicker}>Scenario library</div>
          <h1 className={styles.pageTitle}>
            Browse the tests.
            <br />
            <em>Open the evidence.</em>
          </h1>
          <p className={styles.pageSubtitle}>
            Ecommerce Support Suite v2. Filter the measured library, inspect the
            correct path, and see how each agent handled the same decision.
          </p>
        </div>
        <div className={styles.headerSide}>
          <div className={styles.headerMetrics} aria-label="Scenario library summary">
            <div className={styles.headerMetric}>
              <span className={styles.metricLabel}>Library</span>
              <strong className={`${styles.metricValue} ${styles.metricValueAccent}`}>
                {all.length.toLocaleString()}
              </strong>
              <span className={styles.metricNote}>scenarios loaded</span>
            </div>
            <div className={styles.headerMetric}>
              <span className={styles.metricLabel}>Current view</span>
              <strong className={styles.metricValue}>{filtered.length.toLocaleString()}</strong>
              <span className={styles.metricNote}>match the filters</span>
            </div>
          </div>
          <Button className={styles.headerAction} onClick={() => setCreating(true)}>
            New scenario
          </Button>
        </div>
      </header>

      <section className={styles.filterPanel} aria-labelledby="scenario-filters-title">
        <div className={styles.panelTopbar}>
          <span className={styles.panelKicker} id="scenario-filters-title">
            <strong>01</strong> · Shape the view
          </span>
          <span className={styles.panelSummary}>
            {filtered.length.toLocaleString()} / {all.length.toLocaleString()} visible
          </span>
        </div>
        <div className={styles.filterBody}>
          {/* Library size — the first 200 are the hand-shaped base suite;
              larger sizes extend it deterministically, up to 10,000. */}
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>
              Library size
              <span>Past 200, the base suite extends deterministically.</span>
            </div>
            <div className={styles.chipRail}>
              {LIBRARY_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setLibrarySize(size);
                    setPage(0);
                  }}
                  aria-pressed={librarySize === size}
                  className={`${styles.chip} ${styles.sizeChip}`}
                >
                  {size.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Category</div>
            <div className={styles.chipRail}>
              <FilterChip
                label="All"
                active={filter === null}
                onClick={() => {
                  setFilter(null);
                  setPage(0);
                }}
              />
              {cats.map((category) => (
                <FilterChip
                  key={category}
                  label={category}
                  active={filter === category}
                  onClick={() => {
                    setFilter(filter === category ? null : category);
                    setPage(0);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Difficulty filter — routine warm-ups to brutal adversaries. */}
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Difficulty</div>
            <div className={styles.chipRail}>
              <FilterChip
                label="All"
                active={difficulty === null}
                onClick={() => {
                  setDifficulty(null);
                  setPage(0);
                }}
              />
              {([1, 2, 3, 4, 5] as const).map((level) => (
                <FilterChip
                  key={level}
                  label={`${level} · ${DIFFICULTY_LABELS[level]}`}
                  active={difficulty === level}
                  onClick={() => {
                    setDifficulty(difficulty === level ? null : level);
                    setPage(0);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.tablePanel} aria-labelledby="scenario-results-title">
        <div className={styles.tableTopbar}>
          <span className={styles.tableTitle} id="scenario-results-title">
            Scenarios in view
          </span>
          <span className={styles.panelSummary}>
            {rows.length === 0
              ? "No matches"
              : `${(safePage * PAGE_SIZE + 1).toLocaleString()}–${Math.min(
                  filtered.length,
                  (safePage + 1) * PAGE_SIZE,
                ).toLocaleString()} of ${filtered.length.toLocaleString()}`}
          </span>
        </div>
        <div className={styles.scenarioTableWrap}>
          <table className={styles.scenarioTable}>
            <caption className="sr-only">
              Filtered scenario definitions. Open a row to inspect its evidence.
            </caption>
            <thead>
              <tr>
                <th>ID</th>
                <th>Scenario</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Difficulty</th>
                <th>Correct outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyRow}>
                    No scenarios match these filters — try clearing the category or
                    difficulty.
                  </td>
                </tr>
              )}
              {rows.map((scenario) => (
                <tr
                  key={scenario.id}
                  onClick={() => setSelected(scenario)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(scenario);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Open ${scenario.id}: ${scenario.name}`}
                  className={styles.scenarioRow}
                >
                  <td className={styles.scenarioId}>{scenario.id}</td>
                  <td><span className={styles.scenarioName}>{scenario.name}</span></td>
                  <td><span className={styles.scenarioCategory}>{scenario.category}</span></td>
                  <td>
                    <SeverityLabel severity={scenario.severity} />
                  </td>
                  <td>
                    <DifficultyLabel level={scenario.difficulty} />
                  </td>
                  <td>
                    <span className={styles.scenarioRubric}>{scenario.rubric}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.mobileScenarioList}>
          {rows.length === 0 && (
            <p className={styles.failureEmpty}>
              No scenarios match these filters. Try clearing the category or
              difficulty.
            </p>
          )}
          {rows.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className={styles.mobileScenarioCard}
              onClick={() => setSelected(scenario)}
            >
              <span className={styles.mobileScenarioTop}>
                <span className={styles.scenarioId}>{scenario.id}</span>
                <SeverityLabel severity={scenario.severity} />
              </span>
              <span className={styles.scenarioName}>{scenario.name}</span>
              <span className={styles.mobileScenarioMeta}>
                <span className={styles.scenarioCategory}>{scenario.category}</span>
                <DifficultyLabel level={scenario.difficulty} />
              </span>
              <span className={styles.mobileScenarioRubric}>{scenario.rubric}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className={styles.pagination}>
          <span className={styles.paginationMeta}>
            {(safePage * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min(filtered.length, (safePage + 1) * PAGE_SIZE).toLocaleString()} of{" "}
            {filtered.length.toLocaleString()}
          </span>
          <div className={styles.paginationActions}>
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              ← Prev
            </Button>
            <span className={styles.pageCounter}>
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
            compact
            // Drafts live in this tab only — no page to link to.
            permalinkHref={drafts.includes(selected) ? undefined : `/scenarios/${selected.id}`}
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={styles.chip}
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
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  // Escape closes; focus moves in on open and back out on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      className={styles.drawerDialog}
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <div
        className={styles.drawerBackdrop}
        onClick={onClose}
      />
      <div className={styles.drawerPanel}>
        <div className={styles.drawerHeader}>
          <h2>{title}</h2>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className={styles.drawerClose}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className={styles.drawerBody}>{children}</div>
      </div>
    </div>
  );
}

const inputCls = styles.input;

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
    difficulty: 3 as Difficulty,
    rubric: "",
    persona: "",
    openingMessage: "",
    hiddenFacts: "",
    passCriteria: "",
    mustNot: "",
  });
  const set =
    (key: keyof typeof form) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));
  const lines = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({
          id: `SCN-${String(nextIndex).padStart(4, "0")}`,
          name: form.name || "Untitled scenario",
          category: form.category,
          severity: form.severity,
          difficulty: form.difficulty,
          rubric: form.rubric,
          persona: form.persona,
          openingMessage: form.openingMessage,
          hiddenFacts: lines(form.hiddenFacts),
          passCriteria: lines(form.passCriteria),
          mustNot: lines(form.mustNot),
        });
      }}
    >
      <label className={styles.formLabel}>
        <Eyebrow>Name</Eyebrow>
        <input className={inputCls} value={form.name} onChange={set("name")} placeholder="Refund demanded for a gift card purchase" required />
      </label>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          <Eyebrow>Category</Eyebrow>
          <input className={inputCls} value={form.category} onChange={set("category")} />
        </label>
        <label className={styles.formLabel}>
          <Eyebrow>Severity</Eyebrow>
          <select className={inputCls} value={form.severity} onChange={set("severity")}>
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
        <label className={styles.formLabel}>
          <Eyebrow>Difficulty</Eyebrow>
          <select
            className={inputCls}
            value={form.difficulty}
            onChange={(e) =>
              setForm((f) => ({ ...f, difficulty: Number(e.target.value) as Difficulty }))
            }
          >
            {([1, 2, 3, 4, 5] as const).map((d) => (
              <option key={d} value={d}>
                {d} · {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={styles.formLabel}>
        <Eyebrow>Correct outcome (one line)</Eyebrow>
        <input className={inputCls} value={form.rubric} onChange={set("rubric")} required />
      </label>
      <label className={styles.formLabel}>
        <Eyebrow>Customer persona</Eyebrow>
        <input className={inputCls} value={form.persona} onChange={set("persona")} />
      </label>
      <label className={styles.formLabel}>
        <Eyebrow>Opening message</Eyebrow>
        <textarea className={inputCls} rows={2} value={form.openingMessage} onChange={set("openingMessage")} />
      </label>
      <label className={styles.formLabel}>
        <Eyebrow>Hidden facts (one per line)</Eyebrow>
        <textarea className={inputCls} rows={2} value={form.hiddenFacts} onChange={set("hiddenFacts")} />
      </label>
      <label className={styles.formLabel}>
        <Eyebrow>Pass criteria (one per line)</Eyebrow>
        <textarea className={inputCls} rows={3} value={form.passCriteria} onChange={set("passCriteria")} />
      </label>
      <label className={styles.formLabel}>
        <Eyebrow>Must not (one per line)</Eyebrow>
        <textarea className={inputCls} rows={2} value={form.mustNot} onChange={set("mustNot")} />
      </label>
      <div>
        <Button type="submit" className={styles.formSubmit}>
          Add to suite
        </Button>
      </div>
    </form>
  );
}
