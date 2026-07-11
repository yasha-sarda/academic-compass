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
      ai_logs: {
        Row: {
          assignment_id: string | null
          created_at: string
          id: string
          prompt: string | null
          response: string | null
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          id?: string
          prompt?: string | null
          response?: string | null
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          id?: string
          prompt?: string | null
          response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          archived_at: string | null
          completed_at: string | null
          confidence: number | null
          created_at: string
          deadline: string | null
          deliverables: string[] | null
          description: string | null
          difficulty: string | null
          estimated_hours: number | null
          file_url: string | null
          id: string
          notes: string | null
          priority: string | null
          progress: number
          reasoning: string | null
          skills_required: string[] | null
          source_text: string | null
          source_type: string | null
          status: string
          subject: string | null
          summary: string | null
          tags: string[]
          title: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          deadline?: string | null
          deliverables?: string[] | null
          description?: string | null
          difficulty?: string | null
          estimated_hours?: number | null
          file_url?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          progress?: number
          reasoning?: string | null
          skills_required?: string[] | null
          source_text?: string | null
          source_type?: string | null
          status?: string
          subject?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          deadline?: string | null
          deliverables?: string[] | null
          description?: string | null
          difficulty?: string | null
          estimated_hours?: number | null
          file_url?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          progress?: number
          reasoning?: string | null
          skills_required?: string[] | null
          source_text?: string | null
          source_type?: string | null
          status?: string
          subject?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          assignment_id: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch: string | null
          college: string | null
          course: string | null
          created_at: string
          daily_study_hours: number | null
          email: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          preferred_study_time: string | null
          semester: string | null
          subjects: string[] | null
          university: string | null
          updated_at: string
        }
        Insert: {
          branch?: string | null
          college?: string | null
          course?: string | null
          created_at?: string
          daily_study_hours?: number | null
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          preferred_study_time?: string | null
          semester?: string | null
          subjects?: string[] | null
          university?: string | null
          updated_at?: string
        }
        Update: {
          branch?: string | null
          college?: string | null
          course?: string | null
          created_at?: string
          daily_study_hours?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          preferred_study_time?: string | null
          semester?: string | null
          subjects?: string[] | null
          university?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roadmaps: {
        Row: {
          assignment_id: string
          completed: boolean
          created_at: string
          description: string | null
          duration: number | null
          estimated_time: string | null
          id: string
          order_index: number
          step: string
        }
        Insert: {
          assignment_id: string
          completed?: boolean
          created_at?: string
          description?: string | null
          duration?: number | null
          estimated_time?: string | null
          id?: string
          order_index?: number
          step: string
        }
        Update: {
          assignment_id?: string
          completed?: boolean
          created_at?: string
          description?: string | null
          duration?: number | null
          estimated_time?: string | null
          id?: string
          order_index?: number
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmaps_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
