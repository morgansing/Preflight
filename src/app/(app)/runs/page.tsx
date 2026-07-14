"use client";

import { MissionControl } from "@/components/mission-control";
import { LiveMissionControl } from "@/components/live-mission-control";
import { useMode } from "@/lib/mode";

export default function RunsPage() {
  const { mode } = useMode();
  if (mode === "live") return <LiveMissionControl />;
  return <MissionControl />;
}
