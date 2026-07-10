import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StagePage";
export const Route = createFileRoute("/materials")({ component: () => <StagePage stageId="material-selection" /> });
