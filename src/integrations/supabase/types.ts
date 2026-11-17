export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      remedy_leads: {
        Row: {
          created_at: string;
          created_by: string;
          customer_message: string;
          detected_language: string;
          extracted_quantity: number;
          id: string;
          intent: Database["public"]["Enums"]["remedy_lead_intent"];
          matched_product_id: string | null;
          quoted_total: number | null;
          status: Database["public"]["Enums"]["remedy_lead_status"];
          suggested_reply: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          customer_message: string;
          detected_language: string;
          extracted_quantity?: number;
          id?: string;
          intent: Database["public"]["Enums"]["remedy_lead_intent"];
          matched_product_id?: string | null;
          quoted_total?: number | null;
          status?: Database["public"]["Enums"]["remedy_lead_status"];
          suggested_reply: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          customer_message?: string;
          detected_language?: string;
          extracted_quantity?: number;
          id?: string;
          intent?: Database["public"]["Enums"]["remedy_lead_intent"];
          matched_product_id?: string | null;
          quoted_total?: number | null;
          status?: Database["public"]["Enums"]["remedy_lead_status"];
          suggested_reply?: string;
        };
        Relationships: [
          {
            foreignKeyName: "remedy_leads_matched_product_id_fkey";
            columns: ["matched_product_id"];
            isOneToOne: false;
            referencedRelation: "remedy_products";
            referencedColumns: ["id"];
          },
        ];
      };
      remedy_products: {
        Row: {
          base_price: number;
          category: Database["public"]["Enums"]["remedy_product_category"];
          description: string;
          hindi_name: string;
          id: string;
          in_stock: boolean;
          name: string;
          stock_quantity: number;
          tier10_plus_price: number | null;
          tier100_plus_price: number | null;
          tier50_plus_price: number | null;
          unit: string;
        };
        Insert: {
          base_price: number;
          category: Database["public"]["Enums"]["remedy_product_category"];
          description: string;
          hindi_name: string;
          id?: string;
          in_stock?: boolean;
          name: string;
          stock_quantity?: number;
          tier10_plus_price?: number | null;
          tier100_plus_price?: number | null;
          tier50_plus_price?: number | null;
          unit: string;
        };
        Update: {
          base_price?: number;
          category?: Database["public"]["Enums"]["remedy_product_category"];
          description?: string;
          hindi_name?: string;
          id?: string;
          in_stock?: boolean;
          name?: string;
          stock_quantity?: number;
          tier10_plus_price?: number | null;
          tier100_plus_price?: number | null;
          tier50_plus_price?: number | null;
          unit?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      register_team_agent: {
        Args: {
          agent_email: string;
          agent_password: string;
        };
        Returns: string;
      };
    };
    Enums: {
      remedy_lead_intent:
        "PRICE_ENQUIRY" | "BULK_ORDER" | "AVAILABILITY" | "COMPLAINT" | "GENERAL_QUERY";
      remedy_lead_status: "NEW" | "REPLIED" | "CONVERTED";
      remedy_product_category: "GEMSTONE" | "RUDRAKSHA" | "SPIRITUAL_PRODUCT" | "PUJA_SERVICE";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      remedy_lead_intent: [
        "PRICE_ENQUIRY",
        "BULK_ORDER",
        "AVAILABILITY",
        "COMPLAINT",
        "GENERAL_QUERY",
      ],
      remedy_lead_status: ["NEW", "REPLIED", "CONVERTED"],
      remedy_product_category: ["GEMSTONE", "RUDRAKSHA", "SPIRITUAL_PRODUCT", "PUJA_SERVICE"],
    },
  },
} as const;
