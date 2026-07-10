import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StagePage";
export const Route = createFileRoute("/cutting")({ component: () => <StagePage stageId="bulk-cutting" /> });
