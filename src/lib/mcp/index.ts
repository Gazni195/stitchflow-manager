import { defineMcp } from "@lovable.dev/mcp-js";
import listDesigns from "./tools/list-designs";
import getDesign from "./tools/get-design";
import listSamples from "./tools/list-samples";
import listWorkflowStages from "./tools/list-workflow-stages";
import productionSummary from "./tools/production-summary";

export default defineMcp({
  name: "fawri-lifestyle-mcp",
  title: "Fawri Lifestyle Production",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Fawri Lifestyle garment production workflow. Use `production_summary` for KPIs, `list_designs` / `get_design` for design orders, `list_samples` for sample development, and `list_workflow_stages` for the 12-stage pipeline. Data is sample/mock data (no live database).",
  tools: [productionSummary, listDesigns, getDesign, listSamples, listWorkflowStages],
});
