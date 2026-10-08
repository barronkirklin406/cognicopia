/**
 * Database types, in the shape `supabase gen types typescript` produces, so
 * `createClient<Database>()` is fully typed.
 *
 * Written by hand from supabase/migrations to match them exactly. A test
 * (tests/db/types-parity.test.ts) compares this file's columns and enums with
 * the migrated database, so they cannot drift apart unnoticed. To replace it
 * with generated output: `npm run db:types` (needs the Supabase CLI and a
 * running local stack). Everything else lives in ./models.ts and survives that.
 *
 * ZERO PHI: nothing here describes a resident. See docs/saas-platform-architecture.md.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      activity_calendars: {
        Row: {
          created_at: string;
          facility_id: string;
          generated_data: Json;
          id: string;
          month_year: string;
        };
        Insert: {
          created_at?: string;
          facility_id: string;
          generated_data: Json;
          id?: string;
          month_year: string;
        };
        Update: {
          created_at?: string;
          facility_id?: string;
          generated_data?: Json;
          id?: string;
          month_year?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_calendars_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
        ];
      };
      content_items: {
        Row: {
          category: string;
          content_payload: Json;
          created_at: string;
          dementia_stage: Database["public"]["Enums"]["dementia_stage"];
          id: string;
          title: string;
        };
        Insert: {
          category: string;
          content_payload: Json;
          created_at?: string;
          dementia_stage: Database["public"]["Enums"]["dementia_stage"];
          id?: string;
          title: string;
        };
        Update: {
          category?: string;
          content_payload?: Json;
          created_at?: string;
          dementia_stage?: Database["public"]["Enums"]["dementia_stage"];
          id?: string;
          title?: string;
        };
        Relationships: [];
      };
      facilities: {
        Row: {
          created_at: string;
          facility_name: string;
          id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_cancel_at_period_end: boolean;
          subscription_current_period_end: string | null;
          subscription_interval: string | null;
          subscription_status: Database["public"]["Enums"]["subscription_status"];
          subscription_synced_at: string | null;
        };
        Insert: {
          created_at?: string;
          facility_name: string;
          id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_cancel_at_period_end?: boolean;
          subscription_current_period_end?: string | null;
          subscription_interval?: string | null;
          subscription_status?: Database["public"]["Enums"]["subscription_status"];
          subscription_synced_at?: string | null;
        };
        Update: {
          created_at?: string;
          facility_name?: string;
          id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_cancel_at_period_end?: boolean;
          subscription_current_period_end?: string | null;
          subscription_interval?: string | null;
          subscription_status?: Database["public"]["Enums"]["subscription_status"];
          subscription_synced_at?: string | null;
        };
        Relationships: [];
      };
      facility_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          expires_at: string;
          facility_id: string;
          id: string;
          role: Database["public"]["Enums"]["facility_role"];
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          expires_at: string;
          facility_id: string;
          id?: string;
          role?: Database["public"]["Enums"]["facility_role"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          expires_at?: string;
          facility_id?: string;
          id?: string;
          role?: Database["public"]["Enums"]["facility_role"];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "facility_invites_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
        ];
      };
      facility_users: {
        Row: {
          created_at: string;
          email: string;
          facility_id: string;
          id: string;
          role: Database["public"]["Enums"]["facility_role"];
        };
        Insert: {
          created_at?: string;
          email: string;
          facility_id: string;
          id: string;
          role?: Database["public"]["Enums"]["facility_role"];
        };
        Update: {
          created_at?: string;
          email?: string;
          facility_id?: string;
          id?: string;
          role?: Database["public"]["Enums"]["facility_role"];
        };
        Relationships: [
          {
            foreignKeyName: "facility_users_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_facility_invite: {
        Args: { p_token: string };
        Returns: string;
      };
      apply_stripe_subscription: {
        Args: {
          p_cancel_at_period_end?: boolean;
          p_current_period_end?: string;
          p_customer_id: string;
          p_interval?: string;
          p_observed_at: string;
          p_status: Database["public"]["Enums"]["subscription_status"];
          p_subscription_id: string;
        };
        Returns: string;
      };
      create_facility: {
        Args: { p_facility_name: string };
        Returns: string;
      };
      create_facility_invite: {
        Args: { p_email?: string; p_role?: Database["public"]["Enums"]["facility_role"] };
        Returns: string;
      };
      preview_facility_invite: {
        Args: { p_token: string };
        Returns: {
          email_locked: boolean;
          email_matches: boolean;
          facility_name: string;
          role: Database["public"]["Enums"]["facility_role"];
        }[];
      };
    };
    Enums: {
      dementia_stage: "early" | "middle" | "late" | "universal";
      facility_role: "admin" | "staff";
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
        | "incomplete_expired"
        | "paused";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database["public"];

export type Tables<TableName extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][TableName]["Row"];

export type TablesInsert<TableName extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][TableName]["Insert"];

export type TablesUpdate<TableName extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][TableName]["Update"];

export type Enums<EnumName extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][EnumName];

export const Constants = {
  public: {
    Enums: {
      dementia_stage: ["early", "middle", "late", "universal"],
      facility_role: ["admin", "staff"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
        "paused",
      ],
    },
  },
} as const;
