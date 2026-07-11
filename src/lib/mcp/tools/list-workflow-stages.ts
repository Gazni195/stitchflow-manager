import { defineTool } from "@lovable.dev/mcp-js";
import { WORKFLOW } from "@/lib/workflow";

export default defineTool({
  name: "list_workflow_stages",
  title: "List workflow stages",
  description:
    "List the 12 stages of the Fawri Lifestyle garment production workflow, from Sample Creation to Ready Stock.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const stages = WORKFLOW.map((s) => ({
      step: s.step,
      id: s.id,
      title: s.title,
      phase: s.phase,
      description: s.description,
      route: s.to,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(stages, null, 2) }],
      structuredContent: { stages },
    };
  },
});
