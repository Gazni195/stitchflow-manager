import { createFileRoute } from "@tanstack/react-router";
import { StagePage } from "@/components/StagePage";
export const Route = createFileRoute("/barcode")({ component: () => <StagePage stageId="barcode" /> });
