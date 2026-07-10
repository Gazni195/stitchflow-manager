import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StagePage";
export const Route = createFileRoute("/qc")({ component: () => <StagePage stageId="quality-check" /> });
