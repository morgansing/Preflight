"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { getReplay } from "@/lib/fixtures/replays";
import { scenarioById } from "@/lib/fixtures/scenarios";
import { useMode } from "@/lib/mode";
import { LiveEmpty } from "@/components/live-empty";
import { ReplayView } from "./replay-view";

export default function ReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { mode } = useMode();

  if (mode === "live") return <LiveEmpty surface="Replay" />;

  const scenario = scenarioById.get(id);
  const replay = getReplay(id);
  if (!scenario || !replay) notFound();

  return <ReplayView scenario={scenario} replay={replay} />;
}
