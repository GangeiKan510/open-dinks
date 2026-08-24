export type DbSkillTier = "beginner" | "novice" | "intermediate" | "advanced";

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
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      facilities: {
        Row: {
          id: string;
          slug: string;
          name: string;
          short_name: string;
          tagline: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          short_name: string;
          tagline?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          short_name?: string;
          tagline?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          facility_id: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          facility_id?: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          timezone?: string;
          facility_id?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      venue_members: {
        Row: {
          venue_id: string;
          user_id: string;
          role: "owner" | "admin" | "host";
          created_at: string;
        };
        Insert: {
          venue_id: string;
          user_id: string;
          role?: "owner" | "admin" | "host";
          created_at?: string;
        };
        Update: {
          venue_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "host";
          created_at?: string;
        };
        Relationships: [];
      };
      courts: {
        Row: {
          id: string;
          venue_id: string;
          name: string;
          sort_order: number;
          skill_min: DbSkillTier | null;
          skill_max: DbSkillTier | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          name: string;
          sort_order?: number;
          skill_min?: DbSkillTier | null;
          skill_max?: DbSkillTier | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          name?: string;
          sort_order?: number;
          skill_min?: DbSkillTier | null;
          skill_max?: DbSkillTier | null;
          created_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          venue_id: string;
          name: string;
          skill: DbSkillTier;
          dupr_id: string | null;
          gender: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          name: string;
          skill?: DbSkillTier;
          dupr_id?: string | null;
          gender?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          name?: string;
          skill?: DbSkillTier;
          dupr_id?: string | null;
          gender?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          venue_id: string;
          title: string;
          public_token: string;
          mode: "rotating" | "skill_separated" | "king_of_court" | "singles";
          status: "scheduled" | "live" | "completed";
          court_count: number;
          king_max_consecutive_wins: number;
          max_game_minutes: number;
          started_at: string | null;
          ended_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          title?: string;
          public_token?: string;
          mode?: "rotating" | "skill_separated" | "king_of_court" | "singles";
          status?: "scheduled" | "live" | "completed";
          court_count?: number;
          king_max_consecutive_wins?: number;
          max_game_minutes?: number;
          started_at?: string | null;
          ended_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          title?: string;
          public_token?: string;
          mode?: "rotating" | "skill_separated" | "king_of_court" | "singles";
          status?: "scheduled" | "live" | "completed";
          court_count?: number;
          king_max_consecutive_wins?: number;
          max_game_minutes?: number;
          started_at?: string | null;
          ended_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      session_players: {
        Row: {
          id: string;
          session_id: string;
          player_id: string | null;
          display_name: string;
          skill: DbSkillTier;
          status: "waiting" | "playing" | "resting" | "left";
          games_played: number;
          last_played_at: string | null;
          checked_in_at: string;
          partner_lock_id: string | null;
          avoid_ids: string[];
          consecutive_wins: number;
          queue_order: number | null;
          team_lock_group_id: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id?: string | null;
          display_name: string;
          skill?: DbSkillTier;
          status?: "waiting" | "playing" | "resting" | "left";
          games_played?: number;
          last_played_at?: string | null;
          checked_in_at?: string;
          partner_lock_id?: string | null;
          avoid_ids?: string[];
          consecutive_wins?: number;
          queue_order?: number | null;
          team_lock_group_id?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          player_id?: string | null;
          display_name?: string;
          skill?: DbSkillTier;
          status?: "waiting" | "playing" | "resting" | "left";
          games_played?: number;
          last_played_at?: string | null;
          checked_in_at?: string;
          partner_lock_id?: string | null;
          avoid_ids?: string[];
          consecutive_wins?: number;
          queue_order?: number | null;
          team_lock_group_id?: string | null;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          session_id: string;
          court_id: string | null;
          court_name: string;
          team_a: string[];
          team_b: string[];
          status: "ready" | "active" | "completed";
          winner: string | null;
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          court_id?: string | null;
          court_name: string;
          team_a: string[];
          team_b: string[];
          status?: "ready" | "active" | "completed";
          winner?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          court_id?: string | null;
          court_name?: string;
          team_a?: string[];
          team_b?: string[];
          status?: "ready" | "active" | "completed";
          winner?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      pairing_history: {
        Row: {
          session_id: string;
          player_a: string;
          player_b: string;
          as_partners: number;
          as_opponents: number;
        };
        Insert: {
          session_id: string;
          player_a: string;
          player_b: string;
          as_partners?: number;
          as_opponents?: number;
        };
        Update: {
          session_id?: string;
          player_a?: string;
          player_b?: string;
          as_partners?: number;
          as_opponents?: number;
        };
        Relationships: [];
      };
      session_events: {
        Row: {
          id: string;
          session_id: string;
          actor_id: string | null;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          actor_id?: string | null;
          event_type: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          actor_id?: string | null;
          event_type?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      venue_role: "owner" | "admin" | "host";
      session_mode:
        "rotating" | "skill_separated" | "king_of_court" | "singles";
      session_status: "scheduled" | "live" | "completed";
      session_player_status: "waiting" | "playing" | "resting" | "left";
      match_status: "ready" | "active" | "completed";
      skill_tier: DbSkillTier;
    };
    CompositeTypes: Record<string, never>;
  };
};
