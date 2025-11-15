/**
 * Database Schema Mermaid Diagrams
 *
 * Generated from .claude/specifications/unified-database-schema.md
 */

export const databaseSchemaDiagram = {
  /**
   * Complete ER Diagram showing all tables and relationships
   */
  erDiagram: `
erDiagram
    users ||--o{ user_profiles : "has profile"
    users ||--o{ band_memberships : "member of"
    users ||--o{ songs : "creates (personal)"
    users ||--o{ audit_log : "performs actions"

    bands ||--o{ band_memberships : "has members"
    bands ||--o{ invite_codes : "has invites"
    bands ||--o{ songs : "has songs (context)"
    bands ||--o{ setlists : "has setlists"
    bands ||--o{ shows : "performs shows"
    bands ||--o{ practice_sessions : "has practices"
    bands ||--o{ casting_templates : "has templates"

    songs ||--o{ song_group_memberships : "belongs to groups"
    songs ||--o{ song_castings : "has castings"
    songs ||--o{ song_assignments : "has assignments"

    song_groups ||--o{ song_group_memberships : "contains songs"

    setlists ||--o{ shows : "used in show"
    setlists ||--o{ practice_sessions : "used in practice"

    band_memberships ||--o{ song_assignments : "assigned to"
    band_memberships ||--o{ member_capabilities : "has capabilities"
    band_memberships ||--o{ casting_templates : "created by"

    song_castings ||--o{ song_assignments : "defines"
    song_assignments ||--o{ assignment_roles : "has roles"

    casting_templates ||--o{ song_castings : "applied to"

    users {
        uuid id PK
        string email UK "Unique email"
        string name
        timestamptz created_date
        timestamptz last_login
        string auth_provider "email|google"
    }

    user_profiles {
        uuid id PK
        uuid user_id FK
        string timezone
        string preferred_instrument
        text bio
        text avatar_url
    }

    bands {
        uuid id PK
        string name
        timestamptz created_date
        timestamptz updated_date
        uuid created_by FK
        int version
        uuid last_modified_by FK
    }

    band_memberships {
        uuid id PK
        uuid band_id FK
        uuid user_id FK
        string role "admin|member"
        timestamptz joined_date
        int version
        uuid last_modified_by FK
    }

    invite_codes {
        uuid id PK
        uuid band_id FK
        string code UK "6-char code"
        timestamptz expires_at
        timestamptz created_date
        uuid created_by FK
        int max_uses
        int current_uses
    }

    songs {
        uuid id PK
        string title
        string artist
        int tempo "BPM"
        string key_signature
        int duration_seconds
        text notes
        uuid context_id FK "band_id or user_id"
        string context_type "band|personal"
        timestamptz created_date
        timestamptz updated_date
        uuid created_by FK
        int version
        uuid last_modified_by FK
    }

    song_groups {
        uuid id PK
        uuid band_id FK
        string name
        text description
        timestamptz created_date
        uuid created_by FK
    }

    song_group_memberships {
        uuid id PK
        uuid group_id FK
        uuid song_id FK
        int display_order
        timestamptz added_date
    }

    setlists {
        uuid id PK
        uuid band_id FK
        string name
        jsonb items "Songs, breaks, sections"
        timestamptz created_date
        timestamptz last_modified
        uuid created_by FK
        int version
        uuid last_modified_by FK
    }

    shows {
        uuid id PK
        uuid band_id FK
        string name
        string venue
        timestamptz show_date
        uuid setlist_id FK
        timestamptz created_date
        timestamptz updated_date
        uuid created_by FK
        int version
        uuid last_modified_by FK
    }

    practice_sessions {
        uuid id PK
        uuid band_id FK
        timestamptz session_date
        int duration_minutes
        uuid setlist_id FK
        text notes
        timestamptz created_date
        uuid created_by FK
        int version
        uuid last_modified_by FK
    }

    song_castings {
        uuid id PK
        uuid song_id FK
        uuid context_id FK "band_id or show_id"
        string context_type "band|show"
        uuid template_id FK
        timestamptz created_date
        uuid created_by FK
    }

    song_assignments {
        uuid id PK
        uuid casting_id FK
        uuid membership_id FK
        text notes
        timestamptz created_date
    }

    assignment_roles {
        uuid id PK
        uuid assignment_id FK
        string instrument
        string part "lead|rhythm|backing"
    }

    casting_templates {
        uuid id PK
        uuid band_id FK
        string name
        text description
        jsonb template_data
        timestamptz created_date
        uuid created_by FK
    }

    member_capabilities {
        uuid id PK
        uuid membership_id FK
        string instrument
        string proficiency "beginner|intermediate|advanced|expert"
        boolean can_lead
        text notes
    }

    audit_log {
        uuid id PK
        string table_name
        uuid record_id
        string operation "INSERT|UPDATE|DELETE"
        jsonb old_data
        jsonb new_data
        uuid user_id FK
        timestamptz timestamp
        boolean synced
    }
`,

  /**
   * Sync Architecture Diagram
   */
  syncArchitecture: `
sequenceDiagram
    participant UI as User Interface
    participant App as Application Layer<br/>(camelCase)
    participant Repo as Repository Layer<br/>(Name Mapping)
    participant IDB as IndexedDB<br/>(Dexie, camelCase)
    participant Supa as Supabase<br/>(PostgreSQL, snake_case)
    participant RT as Realtime<br/>(WebSocket)

    Note over UI,RT: Write Operation (User Creates Song)

    UI->>App: createSong({title, artist, ...})
    App->>Repo: save(song, camelCase)

    Repo->>IDB: Insert into 'songs' table
    IDB-->>Repo: Success (camelCase)

    Repo->>Repo: Map camelCase → snake_case
    Repo->>Supa: INSERT into 'songs' table
    Supa->>Supa: Trigger: update_version()
    Supa->>Supa: Trigger: log_to_audit()
    Supa-->>Repo: Success (snake_case)

    Repo->>Repo: Map snake_case → camelCase
    Repo-->>App: Success (camelCase)
    App-->>UI: Song created

    Note over UI,RT: Realtime Sync (Other User's Change)

    RT->>Supa: Listen on 'songs' changes
    Supa-->>RT: song_UPDATE event (snake_case)
    RT->>Repo: Process update
    Repo->>Repo: Map snake_case → camelCase
    Repo->>IDB: Update 'songs' table
    IDB-->>Repo: Success
    Repo->>App: Emit change event
    App->>UI: Re-render with new data

    Note over UI,RT: Version Conflict Resolution

    UI->>App: updateSong(modified)
    App->>Repo: save(song)
    Repo->>IDB: Update local copy
    Repo->>Supa: UPDATE with version check

    alt Version Mismatch
        Supa-->>Repo: Error: Version conflict
        Repo->>Supa: Fetch latest version
        Supa-->>Repo: Latest data (v2)
        Repo->>Repo: Merge changes
        Repo->>IDB: Update to v2
        Repo->>Supa: Retry UPDATE
        Supa-->>Repo: Success (v3)
    else Version Match
        Supa-->>Repo: Success (v2)
    end

    Repo-->>App: Final result
    App-->>UI: Update complete
`,
}
