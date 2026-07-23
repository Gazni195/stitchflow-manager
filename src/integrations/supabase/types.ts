export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      design_images: {
        Row: {
          created_at: string
          created_by: string
          design_id: string
          id: string
          label: string
          path: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          design_id: string
          id?: string
          label?: string
          path: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          design_id?: string
          id?: string
          label?: string
          path?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_images_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      design_materials: {
        Row: {
          created_at: string
          design_id: string
          group_name: string
          id: string
          material_id: string
          quantity: number
          rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          design_id: string
          group_name: string
          id?: string
          material_id: string
          quantity?: number
          rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          design_id?: string
          group_name?: string
          id?: string
          material_id?: string
          quantity?: number
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_materials_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      design_workflows: {
        Row: {
          created_at: string
          design_id: string
          id: string
          kind: string
          locked: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          design_id: string
          id?: string
          kind: string
          locked?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          design_id?: string
          id?: string
          kind?: string
          locked?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_workflows_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      designs: {
        Row: {
          category: string
          code: string
          color: string
          created_at: string
          created_by: string
          customer: string
          id: string
          image_path: string | null
          name: string
          notes: string
          order_quantity: number
          parts: Json
          product_type: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          color?: string
          created_at?: string
          created_by: string
          customer?: string
          id?: string
          image_path?: string | null
          name: string
          notes?: string
          order_quantity?: number
          parts?: Json
          product_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          color?: string
          created_at?: string
          created_by?: string
          customer?: string
          id?: string
          image_path?: string | null
          name?: string
          notes?: string
          order_quantity?: number
          parts?: Json
          product_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          available_stock: number
          code: string
          cost_per_unit: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          rate: number
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          available_stock?: number
          code: string
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          rate?: number
          status?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          available_stock?: number
          code?: string
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          rate?: number
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      operations_catalog: {
        Row: {
          category: string
          icon_url: string | null
          id: string
          logo_url: string | null
          name: string
          repeatable: boolean
          short: string
          sort: number
        }
        Insert: {
          category: string
          icon_url?: string | null
          id: string
          logo_url?: string | null
          name: string
          repeatable?: boolean
          short: string
          sort?: number
        }
        Update: {
          category?: string
          icon_url?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          repeatable?: boolean
          short?: string
          sort?: number
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          module: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
          module: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          module?: string
        }
        Relationships: []
      }
      production_activities: {
        Row: {
          assigned_to: string
          completed_at: string | null
          completed_sizes: Json | null
          created_at: string
          created_by: string | null
          effective_seconds: number | null
          elapsed_seconds: number | null
          id: string
          issued_qty: number
          issued_sizes: Json | null
          notes: string | null
          operation_id: string
          production_order_id: string
          returned_qty: number | null
          size_breakdown: Json | null
          started_at: string
          status: string
          updated_at: string
          variance_reason: string | null
          workstation_id: string | null
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          completed_sizes?: Json | null
          created_at?: string
          created_by?: string | null
          effective_seconds?: number | null
          elapsed_seconds?: number | null
          id?: string
          issued_qty: number
          issued_sizes?: Json | null
          notes?: string | null
          operation_id: string
          production_order_id: string
          returned_qty?: number | null
          size_breakdown?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          variance_reason?: string | null
          workstation_id?: string | null
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          completed_sizes?: Json | null
          created_at?: string
          created_by?: string | null
          effective_seconds?: number | null
          elapsed_seconds?: number | null
          id?: string
          issued_qty?: number
          issued_sizes?: Json | null
          notes?: string | null
          operation_id?: string
          production_order_id?: string
          returned_qty?: number | null
          size_breakdown?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          variance_reason?: string | null
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_activities_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          assigned_line: string | null
          code: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          design_id: string
          id: string
          order_quantity: number
          start_date: string
          status: string
          supervisor: string | null
          updated_at: string
        }
        Insert: {
          assigned_line?: string | null
          code: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          design_id: string
          id?: string
          order_quantity: number
          start_date?: string
          status?: string
          supervisor?: string | null
          updated_at?: string
        }
        Update: {
          assigned_line?: string | null
          code?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          design_id?: string
          id?: string
          order_quantity?: number
          start_date?: string
          status?: string
          supervisor?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      production_processes: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          id: string
          issued_at: string | null
          issued_qty: number | null
          notes: string | null
          operation_id: string
          production_order_id: string
          returned_qty: number | null
          sequence: number
          status: string
          updated_at: string
          worker_type: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          issued_at?: string | null
          issued_qty?: number | null
          notes?: string | null
          operation_id: string
          production_order_id: string
          returned_qty?: number | null
          sequence: number
          status?: string
          updated_at?: string
          worker_type?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          issued_at?: string | null
          issued_qty?: number | null
          notes?: string | null
          operation_id?: string
          production_order_id?: string
          returned_qty?: number | null
          sequence?: number
          status?: string
          updated_at?: string
          worker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_processes_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_reservations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lot_code: string | null
          material_id: string
          notes: string | null
          production_order_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lot_code?: string | null
          material_id: string
          notes?: string | null
          production_order_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lot_code?: string | null
          material_id?: string
          notes?: string | null
          production_order_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_reservations_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_reservations_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_approval_audit: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          design_id: string
          id: string
          notes: string | null
          role: string
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          design_id: string
          id?: string
          notes?: string | null
          role: string
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          design_id?: string
          id?: string
          notes?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_approval_audit_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_approvals: {
        Row: {
          approved_at: string
          approver_name: string
          approver_user_id: string | null
          created_at: string
          design_id: string
          id: string
          notes: string | null
          role: string
          updated_at: string
        }
        Insert: {
          approved_at?: string
          approver_name: string
          approver_user_id?: string | null
          created_at?: string
          design_id: string
          id?: string
          notes?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          approved_at?: string
          approver_name?: string
          approver_user_id?: string | null
          created_at?: string
          design_id?: string
          id?: string
          notes?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_approvals_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_steps: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          custom_area: string | null
          duration_seconds: number | null
          end_date: string | null
          garment_part: string | null
          hourly_rate: number
          id: string
          input_quantity: number | null
          label: string | null
          operation_id: string
          output_quantity: number | null
          remarks: string | null
          sequence: number
          start_date: string | null
          started_at: string | null
          status: string
          updated_at: string
          wastage_quantity: number | null
          work_area: string | null
          workflow_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          custom_area?: string | null
          duration_seconds?: number | null
          end_date?: string | null
          garment_part?: string | null
          hourly_rate?: number
          id?: string
          input_quantity?: number | null
          label?: string | null
          operation_id: string
          output_quantity?: number | null
          remarks?: string | null
          sequence: number
          start_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          wastage_quantity?: number | null
          work_area?: string | null
          workflow_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          custom_area?: string | null
          duration_seconds?: number | null
          end_date?: string | null
          garment_part?: string | null
          hourly_rate?: number
          id?: string
          input_quantity?: number | null
          label?: string | null
          operation_id?: string
          output_quantity?: number | null
          remarks?: string | null
          sequence?: number
          start_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          wastage_quantity?: number | null
          work_area?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "design_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workstation_config: {
        Row: {
          count: number
          created_at: string
          id: string
          label: string
          prefix: string
          sort_order: number
          type_key: string
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          label: string
          prefix: string
          sort_order?: number
          type_key: string
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          label?: string
          prefix?: string
          sort_order?: number
          type_key?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_sample: { Args: { _design_id: string }; Returns: string }
      complete_process: {
        Args: { _process_id: string; _returned_qty: number }
        Returns: undefined
      }
      current_user_permissions: {
        Args: never
        Returns: {
          key: string
        }[]
      }
      ensure_super_admin_seed: { Args: never; Returns: undefined }
      has_design_access: { Args: { _design_id: string }; Returns: boolean }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_production_order_access: {
        Args: { _po_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workflow_access: { Args: { _workflow_id: string }; Returns: boolean }
      issue_bundle: {
        Args: {
          _assigned_to: string
          _issued_qty: number
          _notes: string
          _process_id: string
          _worker_type: string
        }
        Returns: undefined
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          email: string
          roles: Database["public"]["Enums"]["app_role"][]
          user_id: string
        }[]
      }
      revert_sample_approval: {
        Args: { _design_id: string }
        Returns: undefined
      }
      start_bulk_production: {
        Args: { _design_id: string }
        Returns: undefined
      }
      start_production: {
        Args: {
          _design_id: string
          _order_quantity: number
          _start_date: string
          _supervisor: string
        }
        Returns: string
      }
      withdraw_sample_approval: {
        Args: { _design_id: string; _role: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "designer"
        | "marketing"
        | "production_manager"
        | "accountant"
        | "inventory_manager"
        | "operator"
        | "it_developer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "designer",
        "marketing",
        "production_manager",
        "accountant",
        "inventory_manager",
        "operator",
        "it_developer",
      ],
    },
  },
} as const
