import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StagePage";
export const Route = createFileRoute("/sample-making")({ component: () => <StagePage stageId="sample-making" /> });
