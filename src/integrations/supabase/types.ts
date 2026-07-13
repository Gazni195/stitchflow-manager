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
          id: string
          name: string
          repeatable: boolean
          short: string
          sort: number
        }
        Insert: {
          category: string
          id: string
          name: string
          repeatable?: boolean
          short: string
          sort?: number
        }
        Update: {
          category?: string
          id?: string
          name?: string
          repeatable?: boolean
          short?: string
          sort?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_sample: { Args: { _design_id: string }; Returns: string }
      has_design_access: { Args: { _design_id: string }; Returns: boolean }
      has_workflow_access: { Args: { _workflow_id: string }; Returns: boolean }
      start_bulk_production: {
        Args: { _design_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
