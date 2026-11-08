export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assignment_roles: {
        Row: {
          assignment_id: string
          id: string
          is_primary: boolean | null
          name: string
          type: string
        }
        Insert: {
          assignment_id: string
          id?: string
          is_primary?: boolean | null
          name: string
          type: string
        }
        Update: {
          assignment_id?: string
          id?: string
          is_primary?: boolean | null
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'assignment_roles_assignment_id_fkey'
            columns: ['assignment_id']
            isOneToOne: false
            referencedRelation: 'song_assignments'
            referencedColumns: ['id']
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          band_id: string | null
          changed_at: string
          client_info: Json | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          band_id?: string | null
          changed_at?: string
          client_info?: Json | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          band_id?: string | null
          changed_at?: string
          client_info?: Json | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_log_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      band_memberships: {
        Row: {
          band_id: string
          id: string
          joined_date: string
          permissions: string[] | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          band_id: string
          id?: string
          joined_date?: string
          permissions?: string[] | null
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          band_id?: string
          id?: string
          joined_date?: string
          permissions?: string[] | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'band_memberships_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'band_memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      band_roles: {
        Row: {
          band_id: string
          created_date: string
          id: string
          is_default_part: boolean
          key: string
          label: string
          sort: number
        }
        Insert: {
          band_id: string
          created_date?: string
          id?: string
          is_default_part?: boolean
          key: string
          label: string
          sort?: number
        }
        Update: {
          band_id?: string
          created_date?: string
          id?: string
          is_default_part?: boolean
          key?: string
          label?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: 'band_roles_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
        ]
      }
      bands: {
        Row: {
          created_by: string | null
          created_date: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          updated_date: string | null
        }
        Insert: {
          created_by?: string | null
          created_date?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          settings?: Json | null
          updated_date?: string | null
        }
        Update: {
          created_by?: string | null
          created_date?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          settings?: Json | null
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'bands_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      casting_assignments: {
        Row: {
          arrangement: string | null
          band_id: string | null
          confidence: number | null
          context_id: string
          context_type: string
          created_by: string
          created_date: string
          event_lineup_item_id: string | null
          id: string
          is_primary: boolean
          member_id: string | null
          member_name: string | null
          notes: string | null
          priority: number | null
          role_key: string
          setlist_item_id: string | null
          song_id: string | null
          updated_date: string
          version: number
        }
        Insert: {
          arrangement?: string | null
          band_id?: string | null
          confidence?: number | null
          context_id: string
          context_type: string
          created_by: string
          created_date?: string
          event_lineup_item_id?: string | null
          id?: string
          is_primary?: boolean
          member_id?: string | null
          member_name?: string | null
          notes?: string | null
          priority?: number | null
          role_key: string
          setlist_item_id?: string | null
          song_id?: string | null
          updated_date?: string
          version?: number
        }
        Update: {
          arrangement?: string | null
          band_id?: string | null
          confidence?: number | null
          context_id?: string
          context_type?: string
          created_by?: string
          created_date?: string
          event_lineup_item_id?: string | null
          id?: string
          is_primary?: boolean
          member_id?: string | null
          member_name?: string | null
          notes?: string | null
          priority?: number | null
          role_key?: string
          setlist_item_id?: string | null
          song_id?: string | null
          updated_date?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'casting_assignments_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'casting_assignments_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'casting_assignments_event_lineup_item_id_fkey'
            columns: ['event_lineup_item_id']
            isOneToOne: false
            referencedRelation: 'event_lineup_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'casting_assignments_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'casting_assignments_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          },
        ]
      }
      casting_templates: {
        Row: {
          band_id: string
          context_type: string
          created_by: string
          created_date: string
          id: string
          name: string
          template_data: Json
          updated_date: string | null
        }
        Insert: {
          band_id: string
          context_type: string
          created_by: string
          created_date?: string
          id?: string
          name: string
          template_data?: Json
          updated_date?: string | null
        }
        Update: {
          band_id?: string
          context_type?: string
          created_by?: string
          created_date?: string
          id?: string
          name?: string
          template_data?: Json
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'casting_templates_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'casting_templates_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      event_hands: {
        Row: {
          created_date: string
          event_id: string
          event_lineup_item_id: string
          id: string
          note: string | null
          resolved_by: string | null
          resolved_date: string | null
          role_key: string
          status: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_date?: string
          event_id: string
          event_lineup_item_id: string
          id?: string
          note?: string | null
          resolved_by?: string | null
          resolved_date?: string | null
          role_key: string
          status?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_date?: string
          event_id?: string
          event_lineup_item_id?: string
          id?: string
          note?: string | null
          resolved_by?: string | null
          resolved_date?: string | null
          role_key?: string
          status?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'event_hands_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_hands_event_lineup_item_id_fkey'
            columns: ['event_lineup_item_id']
            isOneToOne: false
            referencedRelation: 'event_lineup_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_hands_resolved_by_fkey'
            columns: ['resolved_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_hands_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      event_lineup_items: {
        Row: {
          created_date: string
          display_artist: string
          display_title: string
          event_id: string
          id: string
          key: string | null
          owner_id: string | null
          position: number
          song_id: string | null
          source: string
          tuning: string | null
        }
        Insert: {
          created_date?: string
          display_artist: string
          display_title: string
          event_id: string
          id?: string
          key?: string | null
          owner_id?: string | null
          position?: number
          song_id?: string | null
          source: string
          tuning?: string | null
        }
        Update: {
          created_date?: string
          display_artist?: string
          display_title?: string
          event_id?: string
          id?: string
          key?: string | null
          owner_id?: string | null
          position?: number
          song_id?: string | null
          source?: string
          tuning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'event_lineup_items_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_lineup_items_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_lineup_items_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          },
        ]
      }
      event_lineup_requests: {
        Row: {
          created_date: string
          display_artist: string
          display_title: string
          event_id: string
          id: string
          owner_id: string | null
          parts: string[] | null
          requester_id: string
          resolved_lineup_item_id: string | null
          song_id: string | null
          source: string
          status: string
        }
        Insert: {
          created_date?: string
          display_artist: string
          display_title: string
          event_id: string
          id?: string
          owner_id?: string | null
          parts?: string[] | null
          requester_id: string
          resolved_lineup_item_id?: string | null
          song_id?: string | null
          source: string
          status?: string
        }
        Update: {
          created_date?: string
          display_artist?: string
          display_title?: string
          event_id?: string
          id?: string
          owner_id?: string | null
          parts?: string[] | null
          requester_id?: string
          resolved_lineup_item_id?: string | null
          song_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_lineup_requests_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_lineup_requests_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_lineup_requests_requester_id_fkey'
            columns: ['requester_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_lineup_requests_resolved_lineup_item_id_fkey'
            columns: ['resolved_lineup_item_id']
            isOneToOne: false
            referencedRelation: 'event_lineup_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_lineup_requests_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          },
        ]
      }
      event_participants: {
        Row: {
          access_tier: string
          event_id: string
          id: string
          joined_date: string
          rsvp: string
          user_id: string
        }
        Insert: {
          access_tier?: string
          event_id: string
          id?: string
          joined_date?: string
          rsvp?: string
          user_id: string
        }
        Update: {
          access_tier?: string
          event_id?: string
          id?: string
          joined_date?: string
          rsvp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_participants_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_participants_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          allow_suggestions: boolean
          auto_approve: boolean
          band_id: string | null
          calendar_sequence: number
          calendar_uid: string | null
          created_date: string
          description: string | null
          end_time: string | null
          host_user_id: string
          id: string
          last_modified_by: string | null
          location: string | null
          name: string
          scheduled_date: string
          setlist_id: string | null
          short_code: string | null
          status: string
          timezone: string
          updated_date: string
          venue: string | null
          version: number
          view_token: string | null
          view_token_expires_at: string | null
          visibility: string
        }
        Insert: {
          allow_suggestions?: boolean
          auto_approve?: boolean
          band_id?: string | null
          calendar_sequence?: number
          calendar_uid?: string | null
          created_date?: string
          description?: string | null
          end_time?: string | null
          host_user_id: string
          id?: string
          last_modified_by?: string | null
          location?: string | null
          name: string
          scheduled_date: string
          setlist_id?: string | null
          short_code?: string | null
          status?: string
          timezone?: string
          updated_date?: string
          venue?: string | null
          version?: number
          view_token?: string | null
          view_token_expires_at?: string | null
          visibility?: string
        }
        Update: {
          allow_suggestions?: boolean
          auto_approve?: boolean
          band_id?: string | null
          calendar_sequence?: number
          calendar_uid?: string | null
          created_date?: string
          description?: string | null
          end_time?: string | null
          host_user_id?: string
          id?: string
          last_modified_by?: string | null
          location?: string | null
          name?: string
          scheduled_date?: string
          setlist_id?: string | null
          short_code?: string | null
          status?: string
          timezone?: string
          updated_date?: string
          venue?: string | null
          version?: number
          view_token?: string | null
          view_token_expires_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_host_user_id_fkey'
            columns: ['host_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_last_modified_by_fkey'
            columns: ['last_modified_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_setlist_id_fkey'
            columns: ['setlist_id']
            isOneToOne: false
            referencedRelation: 'setlists'
            referencedColumns: ['id']
          },
        ]
      }
      friend_requests: {
        Row: {
          addressee_id: string
          created_date: string
          id: string
          requester_id: string
          responded_date: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_date?: string
          id?: string
          requester_id: string
          responded_date?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_date?: string
          id?: string
          requester_id?: string
          responded_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'friend_requests_addressee_id_fkey'
            columns: ['addressee_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friend_requests_requester_id_fkey'
            columns: ['requester_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      friendships: {
        Row: {
          created_date: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_date?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_date?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: 'friendships_user_a_fkey'
            columns: ['user_a']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friendships_user_b_fkey'
            columns: ['user_b']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      invite_codes: {
        Row: {
          band_id: string
          code: string
          created_by: string
          created_date: string
          current_uses: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
        }
        Insert: {
          band_id: string
          code: string
          created_by: string
          created_date?: string
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
        }
        Update: {
          band_id?: string
          code?: string
          created_by?: string
          created_date?: string
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'invite_codes_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invite_codes_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      jam_participants: {
        Row: {
          id: string
          jam_session_id: string
          joined_date: string
          shared_contexts: Json
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          jam_session_id: string
          joined_date?: string
          shared_contexts?: Json
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          jam_session_id?: string
          joined_date?: string
          shared_contexts?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'jam_participants_jam_session_id_fkey'
            columns: ['jam_session_id']
            isOneToOne: false
            referencedRelation: 'jam_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jam_participants_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      jam_sessions: {
        Row: {
          created_date: string
          expires_at: string
          host_user_id: string
          id: string
          last_modified_by: string | null
          name: string | null
          saved_setlist_id: string | null
          seed_setlist_id: string | null
          settings: Json | null
          short_code: string
          status: string
          version: number
          view_token: string | null
          view_token_expires_at: string | null
        }
        Insert: {
          created_date?: string
          expires_at: string
          host_user_id: string
          id?: string
          last_modified_by?: string | null
          name?: string | null
          saved_setlist_id?: string | null
          seed_setlist_id?: string | null
          settings?: Json | null
          short_code: string
          status?: string
          version?: number
          view_token?: string | null
          view_token_expires_at?: string | null
        }
        Update: {
          created_date?: string
          expires_at?: string
          host_user_id?: string
          id?: string
          last_modified_by?: string | null
          name?: string | null
          saved_setlist_id?: string | null
          seed_setlist_id?: string | null
          settings?: Json | null
          short_code?: string
          status?: string
          version?: number
          view_token?: string | null
          view_token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'jam_sessions_host_user_id_fkey'
            columns: ['host_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jam_sessions_last_modified_by_fkey'
            columns: ['last_modified_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jam_sessions_saved_setlist_id_fkey'
            columns: ['saved_setlist_id']
            isOneToOne: false
            referencedRelation: 'setlists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'jam_sessions_seed_setlist_id_fkey'
            columns: ['seed_setlist_id']
            isOneToOne: false
            referencedRelation: 'setlists'
            referencedColumns: ['id']
          },
        ]
      }
      jam_song_matches: {
        Row: {
          canonical_artist: string
          canonical_title: string
          computed_at: string
          display_artist: string
          display_title: string
          id: string
          is_confirmed: boolean
          jam_session_id: string
          match_confidence: string
          matched_songs: Json
          participant_count: number
        }
        Insert: {
          canonical_artist: string
          canonical_title: string
          computed_at?: string
          display_artist: string
          display_title: string
          id?: string
          is_confirmed?: boolean
          jam_session_id: string
          match_confidence?: string
          matched_songs?: Json
          participant_count?: number
        }
        Update: {
          canonical_artist?: string
          canonical_title?: string
          computed_at?: string
          display_artist?: string
          display_title?: string
          id?: string
          is_confirmed?: boolean
          jam_session_id?: string
          match_confidence?: string
          matched_songs?: Json
          participant_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'jam_song_matches_jam_session_id_fkey'
            columns: ['jam_session_id']
            isOneToOne: false
            referencedRelation: 'jam_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      member_capabilities: {
        Row: {
          band_id: string
          id: string
          is_primary: boolean | null
          proficiency_level: number | null
          role_type: string
          updated_date: string
          user_id: string
        }
        Insert: {
          band_id: string
          id?: string
          is_primary?: boolean | null
          proficiency_level?: number | null
          role_type: string
          updated_date?: string
          user_id: string
        }
        Update: {
          band_id?: string
          id?: string
          is_primary?: boolean | null
          proficiency_level?: number | null
          role_type?: string
          updated_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'member_capabilities_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'member_capabilities_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_date: string
          id: string
          kind: string
          link: string | null
          payload: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_date?: string
          id?: string
          kind: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_date?: string
          id?: string
          kind?: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      practice_sessions: {
        Row: {
          attendees: Json | null
          band_id: string
          completed_objectives: string[] | null
          created_date: string
          duration: number | null
          end_time: string | null
          id: string
          last_modified_by: string | null
          location: string | null
          notes: string | null
          objectives: string[] | null
          scheduled_date: string
          session_rating: number | null
          setlist_id: string | null
          songs: Json | null
          start_time: string | null
          type: string
          version: number
          wrapup_notes: string | null
        }
        Insert: {
          attendees?: Json | null
          band_id: string
          completed_objectives?: string[] | null
          created_date?: string
          duration?: number | null
          end_time?: string | null
          id?: string
          last_modified_by?: string | null
          location?: string | null
          notes?: string | null
          objectives?: string[] | null
          scheduled_date: string
          session_rating?: number | null
          setlist_id?: string | null
          songs?: Json | null
          start_time?: string | null
          type: string
          version?: number
          wrapup_notes?: string | null
        }
        Update: {
          attendees?: Json | null
          band_id?: string
          completed_objectives?: string[] | null
          created_date?: string
          duration?: number | null
          end_time?: string | null
          id?: string
          last_modified_by?: string | null
          location?: string | null
          notes?: string | null
          objectives?: string[] | null
          scheduled_date?: string
          session_rating?: number | null
          setlist_id?: string | null
          songs?: Json | null
          start_time?: string | null
          type?: string
          version?: number
          wrapup_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'practice_sessions_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'practice_sessions_last_modified_by_fkey'
            columns: ['last_modified_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'practice_sessions_setlist_id_fkey'
            columns: ['setlist_id']
            isOneToOne: false
            referencedRelation: 'setlists'
            referencedColumns: ['id']
          },
        ]
      }
      release_notes: {
        Row: {
          body: string
          published_at: string
          title: string
          version: string
        }
        Insert: {
          body: string
          published_at?: string
          title: string
          version: string
        }
        Update: {
          body?: string
          published_at?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      setlists: {
        Row: {
          band_id: string | null
          context_id: string | null
          context_type: string
          created_by: string
          created_date: string
          fork_count: number | null
          forked_from: string | null
          id: string
          items: Json | null
          jam_session_id: string | null
          last_modified: string
          last_modified_by: string | null
          name: string
          notes: string | null
          show_id: string | null
          source_setlist_id: string | null
          status: string | null
          tags: string[] | null
          version: number
        }
        Insert: {
          band_id?: string | null
          context_id?: string | null
          context_type?: string
          created_by: string
          created_date?: string
          fork_count?: number | null
          forked_from?: string | null
          id?: string
          items?: Json | null
          jam_session_id?: string | null
          last_modified?: string
          last_modified_by?: string | null
          name: string
          notes?: string | null
          show_id?: string | null
          source_setlist_id?: string | null
          status?: string | null
          tags?: string[] | null
          version?: number
        }
        Update: {
          band_id?: string | null
          context_id?: string | null
          context_type?: string
          created_by?: string
          created_date?: string
          fork_count?: number | null
          forked_from?: string | null
          id?: string
          items?: Json | null
          jam_session_id?: string | null
          last_modified?: string
          last_modified_by?: string | null
          name?: string
          notes?: string | null
          show_id?: string | null
          source_setlist_id?: string | null
          status?: string | null
          tags?: string[] | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'setlists_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'setlists_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'setlists_forked_from_fkey'
            columns: ['forked_from']
            isOneToOne: false
            referencedRelation: 'setlists'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'setlists_jam_session_id_fkey'
            columns: ['jam_session_id']
            isOneToOne: false
            referencedRelation: 'jam_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'setlists_last_modified_by_fkey'
            columns: ['last_modified_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'setlists_source_setlist_id_fkey'
            columns: ['source_setlist_id']
            isOneToOne: false
            referencedRelation: 'setlists'
            referencedColumns: ['id']
          },
        ]
      }
      shows: {
        Row: {
          band_id: string
          contacts: Json | null
          created_by: string
          created_date: string
          duration: number | null
          end_time: string | null
          gig_type: string | null
          id: string
          last_modified_by: string | null
          load_in_time: string | null
          location: string | null
          name: string
          notes: string | null
          payment: number | null
          scheduled_date: string
          set_time: string | null
          setlist_id: string | null
          soundcheck_time: string | null
          status: string
          updated_date: string
          venue: string | null
          version: number
        }
        Insert: {
          band_id: string
          contacts?: Json | null
          created_by: string
          created_date?: string
          duration?: number | null
          end_time?: string | null
          gig_type?: string | null
          id?: string
          last_modified_by?: string | null
          load_in_time?: string | null
          location?: string | null
          name: string
          notes?: string | null
          payment?: number | null
          scheduled_date: string
          set_time?: string | null
          setlist_id?: string | null
          soundcheck_time?: string | null
          status?: string
          updated_date?: string
          venue?: string | null
          version?: number
        }
        Update: {
          band_id?: string
          contacts?: Json | null
          created_by?: string
          created_date?: string
          duration?: number | null
          end_time?: string | null
          gig_type?: string | null
          id?: string
          last_modified_by?: string | null
          load_in_time?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          payment?: number | null
          scheduled_date?: string
          set_time?: string | null
          setlist_id?: string | null
          soundcheck_time?: string | null
          status?: string
          updated_date?: string
          venue?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'shows_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shows_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shows_last_modified_by_fkey'
            columns: ['last_modified_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'shows_setlist_id_fkey'
            columns: ['setlist_id']
            isOneToOne: false
            referencedRelation: 'setlists'
            referencedColumns: ['id']
          },
        ]
      }
      song_assignments: {
        Row: {
          added_by: string
          added_date: string
          confidence: number | null
          id: string
          is_primary: boolean | null
          member_id: string
          song_casting_id: string
          updated_date: string | null
        }
        Insert: {
          added_by: string
          added_date?: string
          confidence?: number | null
          id?: string
          is_primary?: boolean | null
          member_id: string
          song_casting_id: string
          updated_date?: string | null
        }
        Update: {
          added_by?: string
          added_date?: string
          confidence?: number | null
          id?: string
          is_primary?: boolean | null
          member_id?: string
          song_casting_id?: string
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'song_assignments_added_by_fkey'
            columns: ['added_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'song_assignments_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'song_assignments_song_casting_id_fkey'
            columns: ['song_casting_id']
            isOneToOne: false
            referencedRelation: 'song_castings'
            referencedColumns: ['id']
          },
        ]
      }
      song_castings: {
        Row: {
          context_id: string
          context_type: string
          created_by: string
          created_date: string
          id: string
          song_id: string
          updated_date: string | null
        }
        Insert: {
          context_id: string
          context_type: string
          created_by: string
          created_date?: string
          id?: string
          song_id: string
          updated_date?: string | null
        }
        Update: {
          context_id?: string
          context_type?: string
          created_by?: string
          created_date?: string
          id?: string
          song_id?: string
          updated_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'song_castings_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'song_castings_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          },
        ]
      }
      song_group_memberships: {
        Row: {
          added_by: string
          added_date: string
          id: string
          song_group_id: string
          song_id: string
        }
        Insert: {
          added_by: string
          added_date?: string
          id?: string
          song_group_id: string
          song_id: string
        }
        Update: {
          added_by?: string
          added_date?: string
          id?: string
          song_group_id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'song_group_memberships_added_by_fkey'
            columns: ['added_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'song_group_memberships_song_group_id_fkey'
            columns: ['song_group_id']
            isOneToOne: false
            referencedRelation: 'song_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'song_group_memberships_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          },
        ]
      }
      song_groups: {
        Row: {
          created_by: string
          created_date: string
          id: string
          name: string
        }
        Insert: {
          created_by: string
          created_date?: string
          id?: string
          name: string
        }
        Update: {
          created_by?: string
          created_date?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'song_groups_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      song_hidden: {
        Row: {
          created_date: string
          song_id: string
          user_id: string
        }
        Insert: {
          created_date?: string
          song_id: string
          user_id: string
        }
        Update: {
          created_date?: string
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'song_hidden_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'song_hidden_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      song_note_entries: {
        Row: {
          band_id: string
          content: string
          created_date: string
          id: string
          session_id: string | null
          session_type: string | null
          song_id: string
          updated_date: string | null
          user_id: string
          version: number
          visibility: string
        }
        Insert: {
          band_id: string
          content: string
          created_date?: string
          id?: string
          session_id?: string | null
          session_type?: string | null
          song_id: string
          updated_date?: string | null
          user_id: string
          version?: number
          visibility?: string
        }
        Update: {
          band_id?: string
          content?: string
          created_date?: string
          id?: string
          session_id?: string | null
          session_type?: string | null
          song_id?: string
          updated_date?: string | null
          user_id?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: 'song_note_entries_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'song_note_entries_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'song_note_entries_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      song_personal_notes: {
        Row: {
          band_id: string
          content: string | null
          created_date: string
          id: string
          song_id: string
          updated_date: string
          user_id: string
          version: number
        }
        Insert: {
          band_id: string
          content?: string | null
          created_date?: string
          id?: string
          song_id: string
          updated_date?: string
          user_id: string
          version?: number
        }
        Update: {
          band_id?: string
          content?: string | null
          created_date?: string
          id?: string
          song_id?: string
          updated_date?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'song_personal_notes_band_id_fkey'
            columns: ['band_id']
            isOneToOne: false
            referencedRelation: 'bands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'song_personal_notes_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'song_personal_notes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      songs: {
        Row: {
          artist: string | null
          chords_url: string | null
          confidence_level: number | null
          context_id: string
          context_type: string
          created_by: string
          created_date: string
          difficulty: number | null
          duration: number | null
          genre: string | null
          guitar_tuning: string | null
          id: string
          key: string | null
          last_modified_by: string | null
          last_practiced: string | null
          linked_from_song_id: string | null
          lyrics_url: string | null
          normalized_artist: string | null
          normalized_title: string | null
          notes: string | null
          recording_url: string | null
          reference_links: Json | null
          song_group_id: string | null
          tempo: number | null
          time_signature: string | null
          title: string
          tuning_id: string | null
          updated_date: string | null
          version: number
          visibility: string | null
        }
        Insert: {
          artist?: string | null
          chords_url?: string | null
          confidence_level?: number | null
          context_id: string
          context_type?: string
          created_by: string
          created_date?: string
          difficulty?: number | null
          duration?: number | null
          genre?: string | null
          guitar_tuning?: string | null
          id?: string
          key?: string | null
          last_modified_by?: string | null
          last_practiced?: string | null
          linked_from_song_id?: string | null
          lyrics_url?: string | null
          normalized_artist?: string | null
          normalized_title?: string | null
          notes?: string | null
          recording_url?: string | null
          reference_links?: Json | null
          song_group_id?: string | null
          tempo?: number | null
          time_signature?: string | null
          title: string
          tuning_id?: string | null
          updated_date?: string | null
          version?: number
          visibility?: string | null
        }
        Update: {
          artist?: string | null
          chords_url?: string | null
          confidence_level?: number | null
          context_id?: string
          context_type?: string
          created_by?: string
          created_date?: string
          difficulty?: number | null
          duration?: number | null
          genre?: string | null
          guitar_tuning?: string | null
          id?: string
          key?: string | null
          last_modified_by?: string | null
          last_practiced?: string | null
          linked_from_song_id?: string | null
          lyrics_url?: string | null
          normalized_artist?: string | null
          normalized_title?: string | null
          notes?: string | null
          recording_url?: string | null
          reference_links?: Json | null
          song_group_id?: string | null
          tempo?: number | null
          time_signature?: string | null
          title?: string
          tuning_id?: string | null
          updated_date?: string | null
          version?: number
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'songs_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'songs_last_modified_by_fkey'
            columns: ['last_modified_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'songs_linked_from_song_id_fkey'
            columns: ['linked_from_song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'songs_tuning_id_fkey'
            columns: ['tuning_id']
            isOneToOne: false
            referencedRelation: 'tunings'
            referencedColumns: ['id']
          },
        ]
      }
      tunings: {
        Row: {
          color: string | null
          context_id: string | null
          context_type: string | null
          created_by: string | null
          created_date: string
          description: string | null
          id: string
          instrument: string
          is_builtin: boolean
          last_modified_by: string | null
          name: string
          pitches: number[]
          slug: string | null
          string_count: number
          updated_date: string
          version: number
        }
        Insert: {
          color?: string | null
          context_id?: string | null
          context_type?: string | null
          created_by?: string | null
          created_date?: string
          description?: string | null
          id?: string
          instrument?: string
          is_builtin?: boolean
          last_modified_by?: string | null
          name: string
          pitches: number[]
          slug?: string | null
          string_count: number
          updated_date?: string
          version?: number
        }
        Update: {
          color?: string | null
          context_id?: string | null
          context_type?: string | null
          created_by?: string | null
          created_date?: string
          description?: string | null
          id?: string
          instrument?: string
          is_builtin?: boolean
          last_modified_by?: string | null
          name?: string
          pitches?: number[]
          slug?: string | null
          string_count?: number
          updated_date?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'tunings_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tunings_last_modified_by_fkey'
            columns: ['last_modified_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      user_preferences: {
        Row: {
          chart: Json
          created_date: string
          list_views: Json
          metronome: Json
          notifications_seen_at: string | null
          push: Json
          theme: string
          timeline: Json
          updated_date: string
          user_id: string
          version: number
        }
        Insert: {
          chart?: Json
          created_date?: string
          list_views?: Json
          metronome?: Json
          notifications_seen_at?: string | null
          push?: Json
          theme?: string
          timeline?: Json
          updated_date?: string
          user_id: string
          version?: number
        }
        Update: {
          chart?: Json
          created_date?: string
          list_views?: Json
          metronome?: Json
          notifications_seen_at?: string | null
          push?: Json
          theme?: string
          timeline?: Json
          updated_date?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'user_preferences_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_date: string
          discoverable: boolean
          display_name: string | null
          friend_code: string | null
          friend_request_policy: string
          id: string
          instruments: string[] | null
          primary_instrument: string | null
          updated_date: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_date?: string
          discoverable?: boolean
          display_name?: string | null
          friend_code?: string | null
          friend_request_policy?: string
          id?: string
          instruments?: string[] | null
          primary_instrument?: string | null
          updated_date?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_date?: string
          discoverable?: boolean
          display_name?: string | null
          friend_code?: string | null
          friend_request_policy?: string
          id?: string
          instruments?: string[] | null
          primary_instrument?: string | null
          updated_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_profiles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      users: {
        Row: {
          account_tier: string
          auth_provider: string | null
          created_date: string
          email: string
          id: string
          last_active_at: string | null
          last_login: string | null
          last_seen_release_version: string | null
          name: string
          tier_updated_at: string | null
        }
        Insert: {
          account_tier?: string
          auth_provider?: string | null
          created_date?: string
          email: string
          id?: string
          last_active_at?: string | null
          last_login?: string | null
          last_seen_release_version?: string | null
          name: string
          tier_updated_at?: string | null
        }
        Update: {
          account_tier?: string
          auth_provider?: string | null
          created_date?: string
          email?: string
          id?: string
          last_active_at?: string | null
          last_login?: string | null
          last_seen_release_version?: string | null
          name?: string
          tier_updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _band_activity: {
        Args: { p_user: string }
        Returns: {
          actor_id: string
          actor_name: string
          band_id: string
          created_at: string
          detail: string
          id: string
          object_id: string
          object_name: string
          object_type: string
          verb: string
        }[]
      }
      are_event_coparticipants: {
        Args: { p_caller: string; p_other: string }
        Returns: boolean
      }
      are_friends: { Args: { u1: string; u2: string }; Returns: boolean }
      are_jam_coparticipants: {
        Args: { p_caller: string; p_song_owner: string }
        Returns: boolean
      }
      builtin_tuning_slug: { Args: { p_label: string }; Returns: string }
      casting_event_ctx_ok: {
        Args: { p_band: string; p_ctx: string; p_slot: string; p_song: string }
        Returns: boolean
      }
      casting_setlist_ctx_ok: {
        Args: { p_band: string; p_ctx: string; p_song: string }
        Returns: boolean
      }
      ensure_friend_code: { Args: never; Returns: string }
      event_allows_suggestions: { Args: { p_event: string }; Returns: boolean }
      event_auto_approve: { Args: { p_event: string }; Returns: boolean }
      event_lineup_item_in_event: {
        Args: { p_event: string; p_item: string }
        Returns: boolean
      }
      gen_event_code: { Args: never; Returns: string }
      gen_friend_code: { Args: never; Returns: string }
      get_jam_session_by_code: {
        Args: { p_code: string }
        Returns: {
          created_date: string
          expires_at: string
          host_user_id: string
          id: string
          last_modified_by: string | null
          name: string | null
          saved_setlist_id: string | null
          seed_setlist_id: string | null
          settings: Json | null
          short_code: string
          status: string
          version: number
          view_token: string | null
          view_token_expires_at: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'jam_sessions'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_emails: {
        Args: { p_user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      increment_invite_code_usage: {
        Args: { p_invite_code_id: string }
        Returns: {
          band_id: string
          code: string
          created_by: string
          created_date: string
          current_uses: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
        }
        SetofOptions: {
          from: '*'
          to: 'invite_codes'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_band_admin: {
        Args: { p_band_id: string; p_user_id: string }
        Returns: boolean
      }
      is_band_member: {
        Args: { p_band_id: string; p_user_id: string }
        Returns: boolean
      }
      is_event_manager: {
        Args: { p_event: string; p_user: string }
        Returns: boolean
      }
      is_event_participant: {
        Args: { p_event: string; p_user: string }
        Returns: boolean
      }
      is_jam_participant: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      join_event_by_code: {
        Args: { p_code: string }
        Returns: {
          out_event_id: string
          out_host_name: string
          out_name: string
          out_scheduled_date: string
        }[]
      }
      join_jam_session: {
        Args: { p_code: string }
        Returns: {
          created_date: string
          expires_at: string
          host_user_id: string
          id: string
          last_modified_by: string | null
          name: string | null
          saved_setlist_id: string | null
          seed_setlist_id: string | null
          settings: Json | null
          short_code: string
          status: string
          version: number
          view_token: string | null
          view_token_expires_at: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'jam_sessions'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_my_contexts: {
        Args: never
        Returns: {
          band_id: string
          has_unread: boolean
          member_count: number
          name: string
          role: string
        }[]
      }
      list_notifications: {
        Args: { p_before?: string; p_limit?: number }
        Returns: {
          actor_id: string
          actor_name: string
          band_id: string
          band_name: string
          created_at: string
          detail: string
          id: string
          is_read: boolean
          link: string
          object_id: string
          object_name: string
          object_type: string
          source: string
          verb: string
        }[]
      }
      mark_notifications_read: {
        Args: { p_ids?: string[] }
        Returns: undefined
      }
      normalize_text: { Args: { input: string }; Returns: string }
      related_names: {
        Args: { p_ids: string[] }
        Returns: {
          name: string
          user_id: string
        }[]
      }
      replace_jam_matches: {
        Args: { p_matches: Json; p_session_id: string }
        Returns: undefined
      }
      resolve_friend_code: {
        Args: { p_code: string }
        Returns: {
          display_name: string
          name: string
          user_id: string
        }[]
      }
      search: {
        Args: {
          p_all?: boolean
          p_band_id?: string
          p_limit?: number
          p_query: string
        }
        Returns: {
          band_id: string
          context_name: string
          duration: number
          id: string
          kind: string
          matched_song: string
          song_count: number
          starts_at: string
          subtitle: string
          title: string
          tuning: string
        }[]
      }
      search_discoverable_users: {
        Args: { p_query: string }
        Returns: {
          name: string
          user_id: string
        }[]
      }
      seed_band_roles: { Args: { p_band: string }; Returns: undefined }
      update_user_activity: { Args: never; Returns: undefined }
      user_belongs_to_band: {
        Args: { check_band_id: string; check_user_id: string }
        Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
