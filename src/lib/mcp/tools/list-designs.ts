import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { DESIGNS } from "@/lib/designs";

export default defineTool({
  name: "list_designs",
  title: "List designs",
  description:
    "List all garment designs currently tracked in Fawri Lifestyle production, with customer, quantity, status, and progress.",
  inputSchema: {
    status: z
      .enum(["Sampling", "Approved", "Cutting", "Stitching", "QC", "Packing", "Ready"])
      .optional()
      .describe("Optional filter by production status."),
    customer: z.string().optional().describe("Optional case-insensitive customer name filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ status, customer }) => {
    const q = customer?.trim().toLowerCase();
    const rows = DESIGNS.filter(
      (d) =>
        (!status || d.status === status) &&
        (!q || d.customer.toLowerCase().includes(q)),
    ).map((d) => ({
      code: d.code,
      name: d.name,
      customer: d.customer,
      quantity: d.quantity,
      status: d.status,
      progress: d.progress,
      fabric: d.fabric,
      color: d.color,
      dueDate: d.dueDate,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { designs: rows, count: rows.length },
    };
  },
});
