import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { SAMPLES } from "@/lib/samples";

export default defineTool({
  name: "list_samples",
  title: "List samples",
  description:
    "List sample development records with status, target date, selected materials, cost totals, and approval progress.",
  inputSchema: {
    status: z
      .enum(["Requested", "In Development", "Ready for Review", "Approved", "Rejected"])
      .optional()
      .describe("Optional filter by sample status."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ status }) => {
    const rows = SAMPLES.filter((s) => !status || s.status === status).map((s) => {
      const materialCost = s.materials
        .filter((m) => m.selected)
        .reduce((sum, m) => sum + m.qty * m.rate, 0);
      const totalCost = s.costs.reduce((sum, c) => sum + c.amount, 0);
      const approvals = s.approvals.map((a) => ({ role: a.role, status: a.status }));
      return {
        code: s.code,
        designCode: s.designCode,
        name: s.name,
        customer: s.customer,
        status: s.status,
        requestedOn: s.requestedOn,
        targetDate: s.targetDate,
        selectedMaterialCost: materialCost,
        totalCost,
        approvals,
      };
    });
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { samples: rows, count: rows.length },
    };
  },
});
