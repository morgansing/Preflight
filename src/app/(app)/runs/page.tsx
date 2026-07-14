"use client";

import { MissionControl } from "@/components/mission-control";
import { LiveEmpty } from "@/components/live-empty";
import { useMode } from "@/lib/mode";

export default function RunsPage() {
  const { mode } = useMode();
  if (mode === "live") return <LiveEmpty surface="Mission Control" />;
  return <MissionControl />;
}
