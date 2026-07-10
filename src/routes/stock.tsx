import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StagePage";
export const Route = createFileRoute("/stock")({ component: () => <StagePage stageId="ready-stock" /> });
