import { defineTool } from "@lovable.dev/mcp-js";
import { DESIGNS } from "@/lib/designs";

export default defineTool({
  name: "production_summary",
  title: "Production summary",
  description:
    "High-level KPIs across all active designs: total orders, units in production, QC pending, ready stock, and average progress.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const totalOrders = DESIGNS.length;
    const totalUnits = DESIGNS.reduce((s, d) => s + d.quantity, 0);
    const inProduction = DESIGNS.filter((d) =>
      ["Cutting", "Stitching", "Packing"].includes(d.status),
    ).length;
    const qcPending = DESIGNS.filter((d) => d.status === "QC").length;
    const readyStock = DESIGNS.filter((d) => d.status === "Ready").length;
    const avgProgress = Math.round(
      DESIGNS.reduce((s, d) => s + d.progress, 0) / (DESIGNS.length || 1),
    );
    const summary = { totalOrders, totalUnits, inProduction, qcPending, readyStock, avgProgress };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
