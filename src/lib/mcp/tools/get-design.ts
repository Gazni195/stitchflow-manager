import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getDesign } from "@/lib/designs";

export default defineTool({
  name: "get_design",
  title: "Get design",
  description: "Get full details for a single design by its code (e.g. FL-2411).",
  inputSchema: {
    code: z.string().min(1).describe("Design code such as FL-2411."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ code }) => {
    const design = getDesign(code);
    if (!design) {
      return {
        content: [{ type: "text", text: `No design found with code "${code}".` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(design, null, 2) }],
      structuredContent: { design },
    };
  },
});
