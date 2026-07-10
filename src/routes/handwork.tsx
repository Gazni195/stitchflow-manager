import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StagePage";
export const Route = createFileRoute("/handwork")({ component: () => <StagePage stageId="bulk-handwork" /> });
