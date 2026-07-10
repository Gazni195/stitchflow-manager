import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StagePage";
export const Route = createFileRoute("/stitching")({ component: () => <StagePage stageId="bulk-stitching" /> });
