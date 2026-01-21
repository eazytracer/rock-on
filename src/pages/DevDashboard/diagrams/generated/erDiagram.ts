/**
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 *
 * This file is generated from the baseline schema migration.
 * To regenerate: npx ts-node scripts/generate-er-diagram.ts
 *
 * Generated: 2026-01-21T04:46:52.779Z
 * Source: supabase/migrations/20251106000000_baseline_schema.sql
 */

export const generatedERDiagram = `
erDiagram
    users ||--o{ user_profiles : "user_id"
    users ||--o{ bands : "created_by"
    users ||--o{ band_memberships : "user_id"
    bands ||--o{ band_memberships : "band_id"
    bands ||--o{ invite_codes : "band_id"
    users ||--o{ invite_codes : "created_by"
    users ||--o{ songs : "created_by"
    users ||--o{ song_groups : "created_by"
    songs ||--o{ song_group_memberships : "song_id"
    song_groups ||--o{ song_group_memberships : "song_group_id"
    users ||--o{ song_group_memberships : "added_by"
    bands ||--o{ setlists : "band_id"
    users ||--o{ setlists : "created_by"
    setlists ||--o{ setlists : "forked_from"
    bands ||--o{ shows : "band_id"
    setlists ||--o{ shows : "setlist_id"
    users ||--o{ shows : "created_by"
    bands ||--o{ practice_sessions : "band_id"
    setlists ||--o{ practice_sessions : "setlist_id"
    users ||--o{ practice_sessions : "last_modified_by"
    songs ||--o{ song_castings : "song_id"
    users ||--o{ song_castings : "created_by"
    song_castings ||--o{ song_assignments : "song_casting_id"
    users ||--o{ song_assignments : "member_id"
    song_assignments ||--o{ assignment_roles : "assignment_id"
    bands ||--o{ casting_templates : "band_id"
    users ||--o{ casting_templates : "created_by"
    users ||--o{ member_capabilities : "user_id"
    bands ||--o{ member_capabilities : "band_id"
    users ||--o{ audit_log : "user_id"
    bands ||--o{ audit_log : "band_id"
    songs ||--o{ song_personal_notes : "song_id"
    users ||--o{ song_personal_notes : "user_id"
    bands ||--o{ song_personal_notes : "band_id"
    songs ||--o{ song_note_entries : "song_id"
    users ||--o{ song_note_entries : "user_id"
    bands ||--o{ song_note_entries : "band_id"

    users {
        uuid id "PK, DEFAULT"
        text email "NOT NULL, UK"
        text name "NOT NULL"
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz last_login
        text auth_provider "DEFAULT"
    }

    user_profiles {
        uuid id "PK, DEFAULT"
        uuid user_id "NOT NULL, FK"
        text display_name
        text primary_instrument
        text[] instruments "DEFAULT"
        text bio
        text avatar_url
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz updated_date "NOT NULL, DEFAULT"
    }

    bands {
        uuid id "PK, DEFAULT"
        text name "NOT NULL"
        text description
        uuid created_by "FK"
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz updated_date
        jsonb settings "DEFAULT"
        boolean is_active "DEFAULT"
    }

    band_memberships {
        uuid id "PK, DEFAULT"
        uuid user_id "NOT NULL, FK"
        uuid band_id "NOT NULL, FK"
        text role "NOT NULL, DEFAULT"
        text[] permissions "DEFAULT"
        timestamptz joined_date "NOT NULL, DEFAULT"
        text status "NOT NULL, DEFAULT"
    }

    invite_codes {
        uuid id "PK, DEFAULT"
        uuid band_id "NOT NULL, FK"
        text code "NOT NULL, UK"
        uuid created_by "NOT NULL, FK"
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz expires_at
        int max_uses "DEFAULT"
        int current_uses "DEFAULT"
        boolean is_active "DEFAULT"
    }

    songs {
        uuid id "PK, DEFAULT"
        text title "NOT NULL"
        text artist
        text key
        int tempo
        text time_signature
        int duration
        int difficulty "DEFAULT"
        text guitar_tuning "DEFAULT"
        text genre
        text notes
        text lyrics_url
        text chords_url
        text recording_url
        jsonb reference_links "DEFAULT"
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz updated_date
        timestamptz last_practiced
        int confidence_level "DEFAULT"
        text context_type "NOT NULL, DEFAULT"
        text context_id "NOT NULL"
        uuid created_by "NOT NULL, FK"
        text visibility "DEFAULT"
        uuid song_group_id
        int version "NOT NULL, DEFAULT"
        uuid last_modified_by "FK"
    }

    song_groups {
        uuid id "PK, DEFAULT"
        text name "NOT NULL"
        uuid created_by "NOT NULL, FK"
        timestamptz created_date "NOT NULL, DEFAULT"
    }

    song_group_memberships {
        uuid id "PK, DEFAULT"
        uuid song_id "NOT NULL, FK"
        uuid song_group_id "NOT NULL, FK"
        uuid added_by "NOT NULL, FK"
        timestamptz added_date "NOT NULL, DEFAULT"
    }

    setlists {
        uuid id "PK, DEFAULT"
        text name "NOT NULL"
        uuid band_id "NOT NULL, FK"
        uuid show_id
        text status "DEFAULT"
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz last_modified "NOT NULL, DEFAULT"
        uuid created_by "NOT NULL, FK"
        text notes
        jsonb items "DEFAULT"
        uuid forked_from "FK"
        int fork_count "DEFAULT"
        int version "NOT NULL, DEFAULT"
        uuid last_modified_by "FK"
        uuid source_setlist_id "FK"
    }

    shows {
        uuid id "PK, DEFAULT"
        text name "NOT NULL"
        text venue
        text location
        uuid band_id "NOT NULL, FK"
        uuid setlist_id "FK"
        timestamptz scheduled_date "NOT NULL"
        text load_in_time
        text soundcheck_time
        text set_time
        text end_time
        int duration
        int payment
        jsonb contacts "DEFAULT"
        text notes
        text gig_type
        text status "NOT NULL, DEFAULT"
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz updated_date "NOT NULL, DEFAULT"
        uuid created_by "NOT NULL, FK"
        int version "NOT NULL, DEFAULT"
        uuid last_modified_by "FK"
    }

    practice_sessions {
        uuid id "PK, DEFAULT"
        uuid band_id "NOT NULL, FK"
        uuid setlist_id "FK"
        timestamptz scheduled_date "NOT NULL"
        timestamptz start_time
        timestamptz end_time
        int duration
        text location
        text type "NOT NULL"
        text notes
        text wrapup_notes
        text[] objectives "DEFAULT"
        text[] completed_objectives "DEFAULT"
        int session_rating
        jsonb songs "DEFAULT"
        jsonb attendees "DEFAULT"
        timestamptz created_date "NOT NULL, DEFAULT"
        int version "NOT NULL, DEFAULT"
        uuid last_modified_by "FK"
    }

    song_castings {
        uuid id "PK, DEFAULT"
        text context_type "NOT NULL"
        text context_id "NOT NULL"
        uuid song_id "NOT NULL, FK"
        uuid created_by "NOT NULL, FK"
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz updated_date
    }

    song_assignments {
        uuid id "PK, DEFAULT"
        uuid song_casting_id "NOT NULL, FK"
        uuid member_id "NOT NULL, FK"
        boolean is_primary "DEFAULT"
        int confidence "DEFAULT"
        uuid added_by "NOT NULL, FK"
        timestamptz added_date "NOT NULL, DEFAULT"
        timestamptz updated_date
    }

    assignment_roles {
        uuid id "PK, DEFAULT"
        uuid assignment_id "NOT NULL, FK"
        text type "NOT NULL"
        text name "NOT NULL"
        boolean is_primary "DEFAULT"
    }

    casting_templates {
        uuid id "PK, DEFAULT"
        uuid band_id "NOT NULL, FK"
        text name "NOT NULL"
        text context_type "NOT NULL"
        uuid created_by "NOT NULL, FK"
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz updated_date
        jsonb template_data "NOT NULL, DEFAULT"
    }

    member_capabilities {
        uuid id "PK, DEFAULT"
        uuid user_id "NOT NULL, FK"
        uuid band_id "NOT NULL, FK"
        text role_type "NOT NULL"
        int proficiency_level "DEFAULT"
        boolean is_primary "DEFAULT"
        timestamptz updated_date "NOT NULL, DEFAULT"
    }

    audit_log {
        uuid id "PK, DEFAULT"
        text table_name "NOT NULL"
        text record_id "NOT NULL"
        text action "NOT NULL"
        uuid user_id "FK"
        text user_name "NOT NULL"
        timestamptz changed_at "NOT NULL, DEFAULT"
        jsonb old_values
        jsonb new_values
        uuid band_id "FK"
        jsonb client_info
    }

    song_personal_notes {
        uuid id "PK, DEFAULT"
        uuid song_id "NOT NULL, FK"
        uuid user_id "NOT NULL, FK"
        uuid band_id "NOT NULL, FK"
        text content
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz updated_date "NOT NULL, DEFAULT"
        int version "NOT NULL, DEFAULT"
    }

    song_note_entries {
        uuid id "PK, DEFAULT"
        uuid song_id "NOT NULL, FK"
        uuid user_id "NOT NULL, FK"
        uuid band_id "NOT NULL, FK"
        text session_type
        uuid session_id
        text content "NOT NULL"
        text visibility "NOT NULL, DEFAULT"
        timestamptz created_date "NOT NULL, DEFAULT"
        timestamptz updated_date
        int version "NOT NULL, DEFAULT"
    }

`

export const generatedAt = '2026-01-21T04:46:52.779Z'
export const sourceFile =
  'supabase/migrations/20251106000000_baseline_schema.sql'
