import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listDesigns from "./tools/list-designs";
import getDesign from "./tools/get-design";
import listProductionOrders from "./tools/list-production-orders";

// Direct Supabase issuer (never the .lovable.cloud proxy). VITE_SUPABASE_PROJECT_ID
// is inlined by Vite at build time. The fallback keeps the issuer well-formed
// during the throwaway manifest-extract eval; real tokens never verify against it.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fawri-production-mcp",
  title: "Fawri Production",
  version: "0.1.0",
  instructions:
    "Tools for the Fawri Lifestyle garment production workspace. Read designs, look up a design by code, and inspect production orders. All calls act as the signed-in user and respect their role permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listDesigns, getDesign, listProductionOrders],
});
