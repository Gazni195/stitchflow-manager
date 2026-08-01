import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ALL_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "designer",
  "marketing",
  "production_manager",
  "accountant",
  "inventory_manager",
  "operator",
  "it_developer",
];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  designer: "Designer",
  marketing: "Marketing",
  production_manager: "Production Manager",
  accountant: "Accountant",
  inventory_manager: "Inventory Manager",
  operator: "Operator / Worker",
  it_developer: "IT & Developer",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Full access to everything, including role & permission management.",
  admin: "Manages day-to-day operations across every module.",
  designer: "Owns designs and sample development.",
  marketing: "Read-only access to designs and reports.",
  production_manager: "Runs production floor, lines and approvals.",
  accountant: "Views costs, inventory and production reports.",
  inventory_manager: "Manages inventory and materials.",
  operator: "Executes assigned production operations.",
  it_developer: "System configuration, users and settings.",
};

export const MODULES = [
  "designs",
  "samples",
  "production",
  "materials",
  "inventory",
  "approvals",
  "lines",
  "reports",
  "users",
  "roles",
  "settings",
] as const;

export const ACTIONS = ["view", "create", "edit", "delete"] as const;

export type PermissionKey = `${(typeof MODULES)[number]}.${(typeof ACTIONS)[number]}`;
