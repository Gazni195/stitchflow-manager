import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StagePage";
export const Route = createFileRoute("/samples")({ component: () => <StagePage stageId="sample-creation" emptyHint="Create your first sample request to kick off a new style." /> });
