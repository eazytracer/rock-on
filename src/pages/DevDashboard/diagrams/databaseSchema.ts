/**
 * Database Schema Mermaid Diagrams
 *
 * ER Diagram is AUTO-GENERATED from baseline schema migration.
 * To regenerate: npx ts-node scripts/generate-er-diagram.ts
 *
 * Sync Architecture diagram is manually maintained.
 */

import {
  generatedERDiagram,
  generatedAt,
  sourceFile,
} from './generated/erDiagram'

export const databaseSchemaDiagram = {
  /**
   * Complete ER Diagram showing all tables and relationships
   * AUTO-GENERATED from baseline schema migration
   */
  erDiagram: generatedERDiagram,

  /**
   * Metadata about the generated diagram
   */
  erDiagramMeta: {
    generatedAt,
    sourceFile,
    regenerateCommand: 'npx ts-node scripts/generate-er-diagram.ts',
  },

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
