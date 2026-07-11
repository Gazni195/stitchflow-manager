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
      design_workflows: {
        Row: {
          approval_notes: string | null
          created_at: string
          design_id: string
          id: string
          kind: string
          locked: boolean
          other_charges: number
          po_number: string | null
          updated_at: string
        }
        Insert: {
          approval_notes?: string | null
          created_at?: string
          design_id: string
          id?: string
          kind: string
          locked?: boolean
          other_charges?: number
          po_number?: string | null
          updated_at?: string
        }
        Update: {
          approval_notes?: string | null
          created_at?: string
          design_id?: string
          id?: string
          kind?: string
          locked?: boolean
          other_charges?: number
          po_number?: string | null
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
          assigned_designer: string
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
          target_cost_per_piece: number
          updated_at: string
        }
        Insert: {
          assigned_designer?: string
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
          target_cost_per_piece?: number
          updated_at?: string
        }
        Update: {
          assigned_designer?: string
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
          target_cost_per_piece?: number
          updated_at?: string
        }
        Relationships: []
      }
      operations_catalog: {
        Row: {
          category: string
          department: string
          id: string
          name: string
          repeatable: boolean
          short: string
          sort: number
        }
        Insert: {
          category: string
          department?: string
          id: string
          name: string
          repeatable?: boolean
          short: string
          sort?: number
        }
        Update: {
          category?: string
          department?: string
          id?: string
          name?: string
          repeatable?: boolean
          short?: string
          sort?: number
        }
        Relationships: []
      }
      sample_bom_items: {
        Row: {
          color: string
          consumption: number
          created_at: string
          design_id: string
          id: string
          kind: string
          name: string
          part_id: string | null
          rate: number
          sequence: number
          unit: string
          updated_at: string
        }
        Insert: {
          color?: string
          consumption?: number
          created_at?: string
          design_id: string
          id?: string
          kind: string
          name: string
          part_id?: string | null
          rate?: number
          sequence?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          color?: string
          consumption?: number
          created_at?: string
          design_id?: string
          id?: string
          kind?: string
          name?: string
          part_id?: string | null
          rate?: number
          sequence?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_bom_items_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          active: boolean
          created_at: string
          daily_wage: number
          department: string
          id: string
          name: string
          phone: string | null
          role: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_wage?: number
          department?: string
          id?: string
          name: string
          phone?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_wage?: number
          department?: string
          id?: string
          name?: string
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      workflow_steps: {
        Row: {
          accumulated_seconds: number
          assigned_to: string | null
          assigned_worker_id: string | null
          completed_at: string | null
          cost_per_piece: number | null
          created_at: string
          end_date: string | null
          id: string
          input_quantity: number | null
          is_paused: boolean
          label: string | null
          operation_id: string
          output_quantity: number | null
          reference_file_name: string | null
          reference_file_path: string | null
          reference_file_size: number | null
          remarks: string | null
          sequence: number
          start_date: string | null
          started_at: string | null
          status: string
          updated_at: string
          wastage_quantity: number | null
          workflow_id: string
        }
        Insert: {
          accumulated_seconds?: number
          assigned_to?: string | null
          assigned_worker_id?: string | null
          completed_at?: string | null
          cost_per_piece?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          input_quantity?: number | null
          is_paused?: boolean
          label?: string | null
          operation_id: string
          output_quantity?: number | null
          reference_file_name?: string | null
          reference_file_path?: string | null
          reference_file_size?: number | null
          remarks?: string | null
          sequence: number
          start_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          wastage_quantity?: number | null
          workflow_id: string
        }
        Update: {
          accumulated_seconds?: number
          assigned_to?: string | null
          assigned_worker_id?: string | null
          completed_at?: string | null
          cost_per_piece?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          input_quantity?: number | null
          is_paused?: boolean
          label?: string | null
          operation_id?: string
          output_quantity?: number | null
          reference_file_name?: string | null
          reference_file_path?: string | null
          reference_file_size?: number | null
          remarks?: string | null
          sequence?: number
          start_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          wastage_quantity?: number | null
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
          {
            foreignKeyName: "workflow_steps_assigned_worker_id_fkey"
            columns: ["assigned_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_sample: {
        Args: { _design_id: string; _notes?: string | null }
        Returns: string
      }
      has_design_access: { Args: { _design_id: string }; Returns: boolean }
      has_workflow_access: { Args: { _workflow_id: string }; Returns: boolean }
      reject_sample: {
        Args: { _design_id: string; _notes?: string | null }
        Returns: undefined
      }
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
