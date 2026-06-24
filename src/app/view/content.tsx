"use client";

import { useSearchParams } from "next/navigation";
import { CircuitView } from "@/features/circuit-view";

export function ViewPageContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("c");
  const title = searchParams.get("t");

  return <CircuitView code={code} title={title} />;
}
