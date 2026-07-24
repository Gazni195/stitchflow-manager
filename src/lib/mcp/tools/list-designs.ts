import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_designs",
  title: "List designs",
  description:
    "List designs from the Fawri production workspace, optionally filtered by status or customer. Returns the most recent designs first. Respects the signed-in user's permissions.",
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe("Optional status filter (e.g. 'draft', 'sampling', 'approved')."),
    customer: z.string().optional().describe("Optional case-insensitive customer name filter."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max rows to return (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, customer, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("designs")
      .select("id, code, name, customer, category, product_type, color, order_quantity, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    if (customer) q = q.ilike("customer", `%${customer}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { designs: data ?? [] },
    };
  },
});
