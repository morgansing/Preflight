"use client";

import Link from "next/link";
import { authHeaders } from "@/lib/supabase";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonLink, Card, Eyebrow } from "./ui";
import { MockBadge } from "./live-mission-control";
import { useMode } from "@/lib/mode";
import { useLiveAgents } from "@/lib/live";
import { fetchProviderStatus } from "@/lib/live-api";
import {
  answersToRules,
  DEFAULT_ANSWERS,
  DEFAULT_TOOLS,
  PLATFORM_OPTIONS,
  RISK_OPTIONS,
  ROLE_OPTIONS,
  RULE_CATEGORIES,
  RULE_SOURCE_LABELS,
  TONE_OPTIONS,
  TOOL_OPTIONS,
  type DraftRule,
  type QuestionnaireAnswers,
  type RuleKind,
} from "@/lib/rulebook-types";
import { DEMO_EXTRACTED_RULES, SAMPLE_POLICY } from "@/lib/fixtures/rulebook";
import { pressureVectors } from "@/lib/scenario-generation";
import type { Severity } from "@/lib/types";

interface GenState {
  status: "preview" | "generating" | "ready" | "error";
  version?: number;
  progress?: number;
  ruleCount?: number;
  total?: number;
  error?: string;
}

/**
 * The Setup wizard: five steps from "what is this agent?" to an
 * approved Rulebook. Every input path is optional — the lightest
 * usable answer wins. AI drafts rules; the human approves them.
 */

type LocalRule = DraftRule & { key: string; enabled: boolean };

const STEPS = ["Agent", "Connect", "Tools", "Policy", "Rulebook"];
const DEMO_KEY = "preflight.demo.setup";

let keySeq = 0;
const nextKey = () => `r${Date.now().toString(36)}_${keySeq++}`;

function dedupe(existing: LocalRule[], drafts: DraftRule[]): LocalRule[] {
  const seen = new Set(existing.map((r) => r.text.toLowerCase().trim()));
  const fresh = drafts
    .filter((d) => !seen.has(d.text.toLowerCase().trim()))
    .map((d) => ({ ...d, key: nextKey(), enabled: true }));
  return [...existing, ...fresh];
}

export function SetupWizard() {
  const { mode } = useMode();
  const { agents } = useLiveAgents();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState("support");
  const [agentRef, setAgentRef] = useState("reference");
  const [tools, setTools] = useState<string[]>(DEFAULT_TOOLS);
  // The Agent Dossier — knowledge the generator reads alongside the rules.
  const [platform, setPlatform] = useState("Shopify");
  const [tone, setTone] = useState("Friendly");
  const [riskTolerance, setRiskTolerance] = useState("low");
  const [rules, setRules] = useState<LocalRule[]>([]);
  // "unreachable" (status fetch failed) renders like unknown — no badge.
  const [provider, setProvider] = useState<"anthropic" | "mock" | null | "unreachable">(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<null | number>(null);

  // Guards every async setState (load + generation poll) after unmount.
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  // Load existing setup.
  useEffect(() => {
    type Existing = {
      role: string;
      agentRef: string;
      tools: string[];
      platform?: string;
      tone?: string;
      riskTolerance?: string;
      rules: LocalRule[];
    };
    const load = async (): Promise<Existing | null> => {
      if (mode === "demo") {
        try {
          const raw = window.localStorage.getItem(DEMO_KEY);
          return raw ? (JSON.parse(raw) as Existing) : null;
        } catch {
          return null;
        }
      }
      const [status, res] = await Promise.all([
        fetchProviderStatus(),
        fetch("/api/setup", { headers: await authHeaders() }),
      ]);
      if (!cancelled.current) setProvider(status);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.profile) return null;
      return {
        role: data.profile.role,
        agentRef: data.profile.agentRef,
        tools: data.profile.tools,
        platform: data.profile.platform,
        tone: data.profile.tone,
        riskTolerance: data.profile.riskTolerance,
        rules: (data.rules as Array<DraftRule & { enabled: boolean }>).map((r) => ({
          ...r,
          key: nextKey(),
        })),
      };
    };
    load()
      .then((existing) => {
        if (!existing || cancelled.current) return;
        setRole(existing.role);
        setAgentRef(existing.agentRef);
        setTools(existing.tools);
        if (existing.platform) setPlatform(existing.platform);
        if (existing.tone) setTone(existing.tone);
        if (existing.riskTolerance) setRiskTolerance(existing.riskTolerance);
        setRules(existing.rules);
      })
      .catch(() => {
        // Offline first load — the wizard still works from its defaults.
      });
  }, [mode]);

  const addDrafts = (drafts: DraftRule[], label: string) => {
    setRules((prev) => {
      const merged = dedupe(prev, drafts);
      setNotice(`${merged.length - prev.length} new rule${merged.length - prev.length === 1 ? "" : "s"} drafted from ${label} — review them in the Rulebook step.`);
      return merged;
    });
    setStep(4);
  };

  const extract = async (input: "url" | "text", content: string, source: DraftRule["source"], label: string) => {
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "demo") {
        // Demo mode is scripted and offline: extraction always returns
        // the pre-baked rules for the sample policy.
        addDrafts(DEMO_EXTRACTED_RULES.map((r) => ({ ...r, source })), label);
        return;
      }
      const res = await fetch("/api/setup/extract", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ input, content, source }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice(json.error ?? `Extraction failed (HTTP ${res.status})`);
        return;
      }
      addDrafts(json.rules as DraftRule[], label);
    } catch {
      setNotice("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const dossier = { role, agentRef, tools, platform, tone, riskTolerance };
      const payload = {
        profile: dossier,
        rules: rules.map((r) => ({
          text: r.text,
          category: r.category,
          severity: r.severity,
          kind: r.kind,
          source: r.source,
          enabled: r.enabled,
        })),
      };
      if (mode === "demo") {
        window.localStorage.setItem(DEMO_KEY, JSON.stringify({ ...dossier, rules }));
        setSaved(rules.filter((r) => r.enabled).length);
        return;
      }
      const res = await fetch("/api/setup", {
        method: "PUT",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(payload),
      });
      if (res.ok) setSaved(rules.filter((r) => r.enabled).length);
      else setNotice("Saving failed — try again.");
    } catch {
      setNotice("Couldn't reach the server — the rulebook wasn't saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const [gen, setGen] = useState<GenState | null>(null);

  // Generate a custom suite: rules × pressure grid. Demo previews the
  // count client-side (its wall is the fixed pre-baked run); live mode
  // runs the real generator and the suite appears in the run launcher.
  const generate = async (perRule: number) => {
    const enabled = rules.filter((r) => r.enabled && r.text.trim());
    if (enabled.length === 0) {
      setNotice("Enable at least one rule before generating.");
      return;
    }
    if (mode === "demo") {
      const total = enabled.reduce(
        (n, r) => n + pressureVectors(r, perRule, riskTolerance).length,
        0,
      );
      setGen({ status: "preview", total, ruleCount: enabled.length });
      return;
    }
    setGen({ status: "generating", progress: 0, ruleCount: enabled.length });
    try {
      await save(); // persist the rulebook the generator reads
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ perRule }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGen({ status: "error", error: json.error ?? `HTTP ${res.status}` });
        return;
      }
    } catch {
      setGen({ status: "error", error: "Couldn't reach the server — try again." });
      return;
    }
    // Poll until ready — stops on unmount, tolerates transient fetch
    // errors, and gives up after ~10 minutes rather than spinning forever.
    let attempts = 0;
    const poll = async () => {
      if (cancelled.current) return;
      if (++attempts > 500) {
        setGen({ status: "error", error: "Generation timed out — check back on the Runs page." });
        return;
      }
      try {
        const r = await fetch("/api/generate", { headers: await authHeaders() });
        const d = await r.json();
        if (cancelled.current || !d.suite) return;
        if (d.suite.status === "generating") {
          setGen({
            status: "generating",
            progress: d.suite.progress,
            ruleCount: d.suite.ruleCount,
            total: d.suite.scenarioCount,
          });
          setTimeout(poll, 1200);
        } else if (d.suite.status === "ready") {
          setGen({ status: "ready", version: d.suite.version, total: d.suite.scenarioCount });
        } else {
          setGen({ status: "error", error: d.suite.error ?? "Generation failed" });
        }
      } catch {
        // Transient network blip mid-generation — keep polling.
        setTimeout(poll, 2400);
      }
    };
    poll();
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <div className="flex items-center justify-between">
        <Eyebrow>Setup</Eyebrow>
        {mode === "demo" ? (
          <span className="font-mono text-[10px] tracking-[0.14em] text-mut">DEMO · SCRIPTED</span>
        ) : provider === "mock" ? (
          <MockBadge />
        ) : null}
      </div>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">
        Teach Preflight your agent
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-sub">
        Five short steps to a Rulebook — the set of testable rules your custom
        scenarios will be generated from. Every step has a light path; the more
        you give it, the sharper the test.
      </p>

      {/* Stepper */}
      <div className="mt-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`focus-ring flex items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-[11px] tracking-wider transition-colors cursor-pointer ${
              i === step ? "bg-raised text-accent" : "text-mut hover:text-sub"
            }`}
          >
            <span className={`flex size-4 items-center justify-center rounded-full border text-[9px] ${i === step ? "border-accent/60" : "border-edge"}`}>
              {i + 1}
            </span>
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {step === 0 && (
          <Card className="space-y-4">
            <div>
              <h2 className="text-[15px] font-medium text-ink">What is this agent?</h2>
              <p className="mt-1 text-[13px] text-sub">
                Picks the domain pack: personas, pressure axes and starter rules.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  disabled={!r.available}
                  onClick={() => setRole(r.id)}
                  className={`focus-ring rounded-lg border p-3.5 text-left transition-colors ${
                    role === r.id
                      ? "border-accent/50 bg-raised"
                      : r.available
                        ? "border-edge cursor-pointer hover:border-mut"
                        : "border-edge opacity-45"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-medium text-ink">{r.label}</span>
                    {!r.available && (
                      <span className="font-mono text-[9px] tracking-[0.12em] text-mut">PACK SOON</span>
                    )}
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed text-sub">{r.blurb}</div>
                </button>
              ))}
            </div>
            <Button onClick={() => setStep(1)}>Continue</Button>
          </Card>
        )}

        {step === 1 && (
          <Card className="space-y-4">
            <div>
              <h2 className="text-[15px] font-medium text-ink">Which agent?</h2>
              <p className="mt-1 text-[13px] text-sub">
                The reference agent works with zero setup.{" "}
                <Link href="/agents/connect" className="text-accent hover:underline">
                  Connect your own →
                </Link>
              </p>
            </div>
            <select
              className="focus-ring w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none"
              value={agentRef}
              onChange={(e) => setAgentRef(e.target.value)}
            >
              <option value="reference">Reference agent (built-in)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.kind.toUpperCase()}
                </option>
              ))}
            </select>
            <Button onClick={() => setStep(2)}>Continue</Button>
          </Card>
        )}

        {step === 2 && (
          <Card className="space-y-5">
            <div>
              <h2 className="text-[15px] font-medium text-ink">Capabilities & dossier</h2>
              <p className="mt-1 text-[13px] text-sub">
                The dossier is knowledge about the agent — the generator reads
                it too. Risk tolerance shapes how adversarial the tests get;
                tone and platform shape how the customers talk.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TOOL_OPTIONS.map((t) => {
                const on = tools.includes(t.name);
                return (
                  <label
                    key={t.name}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${on ? "border-accent/40 bg-raised" : "border-edge hover:border-mut"}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setTools((prev) =>
                          on ? prev.filter((x) => x !== t.name) : [...prev, t.name],
                        )
                      }
                      className="accent-accent"
                    />
                    <span className="text-[13px] text-ink">{t.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-mut">{t.name}</span>
                  </label>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-3 border-t border-edge pt-4">
              <label className="space-y-1.5">
                <Eyebrow>Platform</Eyebrow>
                <select
                  className="focus-ring w-full rounded-lg border border-edge bg-surface px-2.5 py-2 text-[13px] text-ink outline-none"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <Eyebrow>Tone</Eyebrow>
                <select
                  className="focus-ring w-full rounded-lg border border-edge bg-surface px-2.5 py-2 text-[13px] text-ink outline-none"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <Eyebrow>Risk tolerance</Eyebrow>
                <select
                  className="focus-ring w-full rounded-lg border border-edge bg-surface px-2.5 py-2 text-[13px] text-ink outline-none"
                  value={riskTolerance}
                  onChange={(e) => setRiskTolerance(e.target.value)}
                >
                  {RISK_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id[0].toUpperCase() + r.id.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <Button onClick={() => setStep(3)}>Continue</Button>
          </Card>
        )}

        {step === 3 && (
          <PolicyStep
            mode={mode}
            busy={busy}
            notice={notice}
            onExtract={extract}
            onQuestionnaire={(answers) => addDrafts(answersToRules(answers), "your answers")}
            onSkip={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <RulebookEditor
            rules={rules}
            setRules={setRules}
            notice={notice}
            saved={saved}
            busy={busy}
            gen={gen}
            onGenerate={generate}
            onSave={save}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------- Step 4: policy inputs ------------------------- */

function PolicyStep({
  mode,
  busy,
  notice,
  onExtract,
  onQuestionnaire,
  onSkip,
}: {
  mode: "demo" | "live";
  busy: boolean;
  notice: string | null;
  onExtract: (input: "url" | "text", content: string, source: DraftRule["source"], label: string) => void;
  onQuestionnaire: (answers: QuestionnaireAnswers) => void;
  onSkip: () => void;
}) {
  const [tab, setTab] = useState<"url" | "docs" | "prompt" | "transcripts" | "questions">(
    mode === "demo" ? "docs" : "url",
  );
  const [url, setUrl] = useState("");
  const [docText, setDocText] = useState(mode === "demo" ? SAMPLE_POLICY : "");
  const [promptText, setPromptText] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(DEFAULT_ANSWERS);

  const tabs = [
    { id: "url" as const, label: "Help-centre URL" },
    { id: "docs" as const, label: "Paste / upload docs" },
    { id: "prompt" as const, label: "Agent's system prompt" },
    { id: "transcripts" as const, label: "Real conversations" },
    { id: "questions" as const, label: "Answer 7 questions" },
  ];

  const readFile = (file: File) =>
    file.text().then((t) => setDocText((prev) => (prev ? prev + "\n\n" : "") + t));

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-[15px] font-medium text-ink">Teach Preflight your policy</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-sub">
          Use whichever you have — all four converge on the same Rulebook. No
          documents at all? The questions take five minutes.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`focus-ring h-8 rounded-full border px-3.5 text-[12px] transition-colors cursor-pointer ${
              tab === t.id
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-edge text-sub hover:border-mut hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "url" && (
        <div className="space-y-3">
          <p className="text-[13px] text-sub">
            Most refund and returns policies are public. Paste the page and
            Preflight reads it.
          </p>
          <input
            className="focus-ring w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none"
            placeholder="https://help.yourstore.com/returns"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button
            disabled={busy || !url.trim()}
            onClick={() => onExtract("url", url, "help_centre", "your help centre")}
          >
            {busy ? "Reading…" : "Extract rules"}
          </Button>
        </div>
      )}

      {tab === "docs" && (
        <div className="space-y-3">
          <p className="text-[13px] text-sub">
            Any text that encodes your rules: an SOP, a Notion export, even a
            three-line email. Polish not required.
            {mode === "demo" && " (Demo: the sample policy below is pre-filled.)"}
          </p>
          <textarea
            className="focus-ring h-48 w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 font-mono text-[12px] leading-relaxed text-ink outline-none"
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            placeholder="Paste your policy text…"
          />
          <div className="flex items-center gap-3">
            <Button
              disabled={busy || docText.trim().length < 40}
              onClick={() => onExtract("text", docText, "document", "your documents")}
            >
              {busy ? "Extracting…" : "Extract rules"}
            </Button>
            <label className="focus-ring cursor-pointer rounded-lg border border-edge px-3.5 py-2 text-[13px] text-sub transition-colors hover:border-mut hover:text-ink">
              Upload .txt / .md
              <input
                type="file"
                accept=".txt,.md,.markdown,text/plain"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
              />
            </label>
          </div>
        </div>
      )}

      {tab === "prompt" && (
        <div className="space-y-3">
          <p className="text-[13px] text-sub">
            The most concentrated policy document most teams own is the agent&apos;s
            own system prompt — paste it and Preflight extracts the rules it
            claims to follow.
          </p>
          <textarea
            className="focus-ring h-48 w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 font-mono text-[12px] leading-relaxed text-ink outline-none"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Paste your agent's system prompt…"
          />
          <Button
            disabled={busy || promptText.trim().length < 40}
            onClick={() => onExtract("text", promptText, "agent_prompt", "the agent's prompt")}
          >
            {busy ? "Extracting…" : "Extract rules"}
          </Button>
        </div>
      )}

      {tab === "transcripts" && (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-sub">
            Paste real customer conversations — a support-ticket export, chat logs,
            even one bad thread. Preflight mines them for the rules your agent should
            have followed, so every real-world incident becomes a permanent
            regression test.
          </p>
          <textarea
            className="focus-ring h-48 w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 font-mono text-[12px] leading-relaxed text-ink outline-none"
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder={"Customer: I want a refund for order #A1234…\nAgent: Sure, I've processed that refund…"}
          />
          <div className="flex items-center gap-3">
            <Button
              disabled={busy || transcriptText.trim().length < 40}
              onClick={() => onExtract("text", transcriptText, "transcript", "your real conversations")}
            >
              {busy ? "Mining…" : "Mine rules from conversations"}
            </Button>
            <label className="focus-ring cursor-pointer rounded-lg border border-edge px-3.5 py-2 text-[13px] text-sub transition-colors hover:border-mut hover:text-ink">
              Upload .txt / .csv
              <input
                type="file"
                accept=".txt,.csv,.md,text/plain,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void f.text().then((t) => setTranscriptText((prev) => (prev ? prev + "\n\n" : "") + t));
                }}
              />
            </label>
          </div>
        </div>
      )}

      {tab === "questions" && (
        <Questionnaire answers={answers} setAnswers={setAnswers} onDone={() => onQuestionnaire(answers)} />
      )}

      {notice && (
        <p className="rounded-lg border border-warn/40 bg-warn/8 p-3 text-[13px] text-warn">{notice}</p>
      )}

      <button onClick={onSkip} className="focus-ring rounded text-[13px] text-mut hover:text-sub cursor-pointer">
        Skip for now — use the starter rules →
      </button>
    </Card>
  );
}

function Questionnaire({
  answers,
  setAnswers,
  onDone,
}: {
  answers: QuestionnaireAnswers;
  setAnswers: (a: QuestionnaireAnswers) => void;
  onDone: () => void;
}) {
  const set = <K extends keyof QuestionnaireAnswers>(k: K, v: QuestionnaireAnswers[K]) =>
    setAnswers({ ...answers, [k]: v });
  const toggle = (k: "neverRefund" | "escalationTriggers", item: string) => {
    const list = answers[k];
    set(k, list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };
  const numInput = (value: number | null, onChange: (n: number | null) => void, width = "w-24") => (
    <input
      type="number"
      className={`focus-ring ${width} rounded-lg border border-edge bg-surface px-3 py-1.5 text-sm text-ink outline-none`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );

  return (
    <div className="space-y-5">
      <Q label="1 · Returns are accepted within how many days? (blank = no limit)">
        {numInput(answers.refundWindowDays, (n) => set("refundWindowDays", n))}
      </Q>
      <Q label="2 · Above what amount must a human approve a refund? (blank = never required)">
        <div className="flex items-center gap-2">
          <select
            className="focus-ring rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm text-ink outline-none"
            value={answers.currency}
            onChange={(e) => set("currency", e.target.value as QuestionnaireAnswers["currency"])}
          >
            <option>£</option>
            <option>$</option>
            <option>€</option>
          </select>
          {numInput(answers.approvalThreshold, (n) => set("approvalThreshold", n))}
        </div>
      </Q>
      <Q label="3 · Which can never be refunded without a defect?">
        <CheckRow options={["gift cards", "final-sale items", "personalised items"]} selected={answers.neverRefund} onToggle={(x) => toggle("neverRefund", x)} />
      </Q>
      <Q label="4 · Refunds only ever go to the original payment method?">
        <YesNo value={answers.originalMethodOnly} onChange={(v) => set("originalMethodOnly", v)} />
      </Q>
      <Q label="5 · Must identity be verified before account or address changes?">
        <YesNo value={answers.verifyIdentity} onChange={(v) => set("verifyIdentity", v)} />
      </Q>
      <Q label="6 · A human must take over when the customer mentions…">
        <CheckRow options={["legal threats", "safety complaints", "the press", "third unresolved contact"]} selected={answers.escalationTriggers} onToggle={(x) => toggle("escalationTriggers", x)} />
      </Q>
      <Q label="7 · Maximum goodwill discount the agent may offer (%)? (blank = none allowed)">
        {numInput(answers.maxGoodwillPct, (n) => set("maxGoodwillPct", n), "w-20")}
      </Q>
      <Button onClick={onDone}>Turn answers into rules</Button>
    </div>
  );
}

function Q({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[13px] text-ink">{label}</div>
      {children}
    </div>
  );
}

function CheckRow({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (x: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onToggle(o)}
          className={`focus-ring h-8 rounded-full border px-3 text-[12px] transition-colors cursor-pointer ${
            selected.includes(o)
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-edge text-sub hover:border-mut"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`focus-ring h-8 rounded-full border px-4 text-[12px] transition-colors cursor-pointer ${
            value === v ? "border-accent/50 bg-accent/10 text-accent" : "border-edge text-sub hover:border-mut"
          }`}
        >
          {v ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

/* ------------------------- Step 5: the Rulebook ------------------------- */

function RulebookEditor({
  rules,
  setRules,
  notice,
  saved,
  busy,
  gen,
  onGenerate,
  onSave,
  onBack,
}: {
  rules: LocalRule[];
  setRules: React.Dispatch<React.SetStateAction<LocalRule[]>>;
  notice: string | null;
  saved: number | null;
  busy: boolean;
  gen: GenState | null;
  onGenerate: (perRule: number) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const [perRule, setPerRule] = useState(6);
  const grouped = useMemo(() => {
    const map = new Map<string, LocalRule[]>();
    for (const cat of RULE_CATEGORIES) map.set(cat, []);
    for (const r of rules) (map.get(r.category) ?? map.get("Other"))!.push(r);
    return [...map.entries()].filter(([, list]) => list.length > 0);
  }, [rules]);

  const update = (key: string, patch: Partial<LocalRule>) =>
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRules((prev) => prev.filter((r) => r.key !== key));
  const addManual = () =>
    setRules((prev) => [
      ...prev,
      {
        key: nextKey(),
        text: "",
        category: "Other",
        severity: "medium" as Severity,
        kind: "must" as RuleKind,
        source: "manual",
        enabled: true,
      },
    ]);

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-5">
      <Card className="space-y-1">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-medium text-ink">The Rulebook</h2>
          <span className="font-mono text-[12px] tabular-nums text-sub">
            {enabledCount} active · {rules.length} total
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-sub">
          AI drafted these; you approve them. Edit anything, switch MUST /
          MUST NOT, disable what doesn&apos;t apply. This is the contract your
          scenarios will be generated from.
        </p>
        {notice && <p className="pt-2 text-[13px] text-accent">{notice}</p>}
      </Card>

      {rules.length === 0 && (
        <Card className="text-center text-sm text-sub">
          No rules yet — go back and feed Preflight a policy, answer the
          questions, or add rules by hand below.
        </Card>
      )}

      {grouped.map(([category, list]) => (
        <div key={category}>
          <Eyebrow className="mb-2">{category} · {list.length}</Eyebrow>
          <div className="space-y-2">
            {list.map((r) => (
              <div
                key={r.key}
                className={`rounded-lg border p-3.5 transition-opacity ${r.enabled ? "border-edge bg-surface" : "border-edge/60 bg-surface opacity-45"}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => update(r.key, { kind: r.kind === "must" ? "must_not" : "must" })}
                    title="Toggle MUST / MUST NOT"
                    className={`focus-ring mt-0.5 w-20 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[9px] tracking-[0.12em] cursor-pointer ${
                      r.kind === "must_not"
                        ? "bg-fail/10 text-fail ring-1 ring-inset ring-fail/30"
                        : "bg-accent/10 text-accent ring-1 ring-inset ring-accent/30"
                    }`}
                  >
                    {r.kind === "must_not" ? "MUST NOT" : "MUST"}
                  </button>
                  <textarea
                    rows={2}
                    className="focus-ring min-h-[2.5rem] flex-1 resize-y rounded-md border border-transparent bg-transparent text-[13px] leading-relaxed text-ink outline-none hover:border-edge focus:border-edge"
                    value={r.text}
                    placeholder="State the rule…"
                    onChange={(e) => update(r.key, { text: e.target.value })}
                  />
                </div>
                <div className="mt-2 flex items-center gap-3 pl-[92px] font-mono text-[10px] tracking-wider text-mut">
                  <select
                    className="focus-ring rounded border border-edge bg-surface px-1.5 py-0.5 text-[10px] text-sub outline-none"
                    value={r.severity}
                    onChange={(e) => update(r.key, { severity: e.target.value as Severity })}
                  >
                    <option value="critical">CRITICAL</option>
                    <option value="high">HIGH</option>
                    <option value="medium">MEDIUM</option>
                    <option value="low">LOW</option>
                  </select>
                  <select
                    className="focus-ring rounded border border-edge bg-surface px-1.5 py-0.5 text-[10px] text-sub outline-none"
                    value={r.category}
                    onChange={(e) => update(r.key, { category: e.target.value })}
                  >
                    {RULE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <span>{RULE_SOURCE_LABELS[r.source]}</span>
                  <span className="ml-auto flex items-center gap-3">
                    <button
                      onClick={() => update(r.key, { enabled: !r.enabled })}
                      className="focus-ring cursor-pointer text-sub hover:text-ink"
                    >
                      {r.enabled ? "disable" : "enable"}
                    </button>
                    <button onClick={() => remove(r.key)} className="focus-ring cursor-pointer text-sub hover:text-fail">
                      delete
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={addManual}>
          Add rule
        </Button>
        <Button variant="ghost" onClick={onBack}>
          ← Add another source
        </Button>
        <div className="flex-1" />
        <Button onClick={onSave} disabled={busy || rules.some((r) => r.enabled && !r.text.trim())}>
          {busy ? "Saving…" : "Approve rulebook"}
        </Button>
      </div>

      {saved !== null && (
        <Card raised className="animate-fade-up space-y-4">
          <div>
            <div className="text-[15px] font-medium text-ink">
              ✓ Rulebook approved — {saved} active rules
            </div>
            <p className="mt-1 text-[13px] text-sub">
              This is the contract Preflight tests against. Now turn it into
              scenarios: each rule × a pressure grid (emotion, boundary
              amounts, identity, deception).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-edge pt-4">
            <label className="flex items-center gap-2 text-[13px] text-sub">
              Scenarios per rule
              <select
                className="focus-ring rounded-lg border border-edge bg-surface px-2 py-1.5 text-[13px] text-ink outline-none"
                value={perRule}
                onChange={(e) => setPerRule(Number(e.target.value))}
              >
                {[4, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="font-mono text-[12px] tabular-nums text-mut">
              ≈ {saved * perRule} scenarios
            </span>
            <div className="flex-1" />
            <Button
              onClick={() => onGenerate(perRule)}
              disabled={gen?.status === "generating"}
            >
              {gen?.status === "generating" ? "Generating…" : "Generate custom suite"}
            </Button>
          </div>

          {gen?.status === "preview" && (
            <div className="rounded-lg border border-accent/30 bg-accent/8 p-4 text-[13px] text-sub">
              <span className="text-accent">Preview:</span> {gen.ruleCount} rules
              × the pressure grid ={" "}
              <span className="text-ink">{gen.total} scenarios</span>. Demo mode
              previews the count offline — switch to Live mode to generate a
              runnable suite through the real engine.
            </div>
          )}
          {gen?.status === "generating" && (
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-edge">
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${gen.ruleCount ? Math.round(((gen.progress ?? 0) / gen.ruleCount) * 100) : 5}%` }}
                />
              </div>
              <p className="font-mono text-[12px] text-mut">
                {gen.progress ?? 0}/{gen.ruleCount} rules · {gen.total ?? 0} scenarios so far…
              </p>
            </div>
          )}
          {gen?.status === "ready" && (
            <div className="flex items-center justify-between rounded-lg border border-accent/40 bg-accent/8 p-4">
              <div className="text-[13px] text-ink">
                ✓ Generated {gen.total} scenarios — suite v{gen.version} is ready to run.
              </div>
              <ButtonLink href="/runs">Run it →</ButtonLink>
            </div>
          )}
          {gen?.status === "error" && (
            <p className="rounded-lg border border-warn/40 bg-warn/8 p-3 text-[13px] text-warn">
              {gen.error}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
