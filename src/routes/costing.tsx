import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StagePage";
export const Route = createFileRoute("/costing")({ component: () => <StagePage stageId="costing" /> });
