# Context-Specific Casting System
## User Journey for Multi-Role Band Member Assignments

### Problem Statement

Current systems treat song assignments as static, but real bands have dynamic role assignments:

**Real-World Scenarios:**
- **Sarah** usually plays rhythm guitar but sings lead on "Wonderwall"
- **Mike** plays bass normally but switches to keyboard for "Let It Be"
- **The acoustic set** has different vocal arrangements than the full electric show
- **Practice sessions** might have someone learning a new part vs. performance assignments
- **Same song, different contexts:** "Hotel California" has different guitar parts for intimate venue vs. stadium show

**Current Problem:** Existing systems assign instruments to people globally, ignoring context-specific needs.

---

## User Journey: "The Rockers" Plan Their Next Show

### 🎭 **Context Setup**

**Band Members:**
- **Sarah:** Primary guitar, secondary vocals
- **Mike:** Primary bass, can play keyboard
- **Jake:** Primary drums, backup vocals
- **Emma:** Primary vocals, some guitar

**Upcoming Events:**
- **Practice Session:** Thursday rehearsal for acoustic set
- **Acoustic Show:** Saturday coffee shop (3-piece: guitar, vocals, light percussion)
- **Electric Show:** Next month at venue (full 4-piece band)

---

## Journey Phase 1: Creating Acoustic Setlist

### 🎵 **Setlist Creation Flow**

#### **Step 1: Emma (band leader) creates new setlist**
```
"Create New Setlist"
├── Name: "Coffee Shop Acoustic Set"
├── Show Date: Saturday 8pm
├── Venue: "Java Junction"
├── Format: "Acoustic" (affects default casting suggestions)
└── Expected Attendees: Sarah, Emma, Jake
```

#### **Step 2: Adding songs with context-aware casting**
```
Adding "Wonderwall" to setlist...

🎯 Casting for "Coffee Shop Acoustic Set":
┌─────────────────────────────────────────────────────────┐
│ 🎵 Wonderwall - Oasis                                   │
├─────────────────────────────────────────────────────────┤
│ Available Members: Sarah, Emma, Jake                    │
│                                                         │
│ Casting Assignments:                                    │
│ ┌─────────────────┬─────────────────┬─────────────────┐ │
│ │ Sarah          │ Emma            │ Jake            │ │
│ │ ☑️ Acoustic Guitar│ ☑️ Lead Vocals   │ ☐ Percussion    │ │
│ │ ☐ Backup Vocals │ ☐ Rhythm Guitar │ ☑️ Backup Vocals │ │
│ │ ☐ Lead Vocals   │ ☐ Bass          │ ☐ Shaker        │ │
│ └─────────────────┴─────────────────┴─────────────────┘ │
│                                                         │
│ 💡 Smart Suggestions:                                   │
│ • Sarah: Usually plays this song (confidence: ⭐⭐⭐⭐)    │
│ • Emma: Strong vocal on this key (A minor)             │
│ • Jake: Can add light percussion for acoustic feel     │
│                                                         │
│ [💾 Save Casting] [📋 Copy from Previous] [🎯 Auto-Cast] │
└─────────────────────────────────────────────────────────┘
```

#### **Step 3: Multi-role assignment interface**
```
Sarah's Assignment for "Wonderwall":
┌─────────────────────────────────────────────────────────┐
│ Primary Role: ● Acoustic Guitar                         │
│                                                         │
│ Additional Roles:                                       │
│ ☐ Lead Vocals     ☐ Backup Vocals   ☐ Harmonica       │
│ ☐ Mandolin        ☐ Cajon           ☐ Tambourine      │
│                                                         │
│ Notes for this casting:                                 │
│ "Play the intro fingerpicking, join vocals on chorus"  │
│                                                         │
│ Confidence: ⭐⭐⭐⭐⭐ Ready to perform                    │
└─────────────────────────────────────────────────────────┘
```

---

## Journey Phase 2: Practice Session Planning

### 🎯 **Practice with Context-Specific Focus**

#### **Step 1: Creating practice session**
```
"Schedule Practice Session"
├── Date: Thursday 7pm
├── Focus: "Prep for Coffee Shop Acoustic"
├── Related Setlist: "Coffee Shop Acoustic Set" ← KEY CONNECTION
└── Expected Attendees: Sarah, Emma, Jake
```

#### **Step 2: Practice song assignments inherit from setlist**
```
Practice Session: "Acoustic Set Prep"

🎵 Songs to Practice:
┌─────────────────────────────────────────────────────────┐
│ 1. Wonderwall                                           │
│    ├── Sarah: Acoustic Guitar (⭐⭐⭐⭐⭐)                  │
│    ├── Emma: Lead Vocals (⭐⭐⭐)                          │
│    └── Jake: Backup Vocals (⭐⭐)                         │
│                                                         │
│    🎯 Practice Goals:                                    │
│    • Sarah: Work on intro fingerpicking timing         │
│    • Emma: Practice key change for acoustic version    │
│    • Jake: Learn harmony parts for chorus              │
│                                                         │
│ 2. Let It Be                                            │
│    ├── Emma: Lead Vocals + Piano (⭐⭐⭐)                  │
│    ├── Sarah: Acoustic Guitar (⭐⭐⭐⭐)                    │
│    └── Jake: Light Percussion (⭐⭐⭐)                     │
│                                                         │
│    🎯 Practice Goals:                                    │
│    • Emma: Work on piano/vocal coordination            │
│    • All: Timing for the stripped-down arrangement     │
└─────────────────────────────────────────────────────────┘
```

#### **Step 3: During practice - role flexibility**
```
🎵 Currently Practicing: "Wonderwall"

Active Assignments (from Coffee Shop setlist):
├── Sarah: Acoustic Guitar ⭐⭐⭐⭐⭐
├── Emma: Lead Vocals ⭐⭐⭐
└── Jake: Backup Vocals ⭐⭐

🔄 Practice Mode Options:
┌─────────────────────────────────────────────────────────┐
│ [🎸 Run as planned] - Practice with setlist assignments │
│ [🔄 Try variations] - Experiment with different roles   │
│ [👥 Who knows what?] - See everyone's experience       │
│ [📝 Update casting] - Change assignments for show      │
└─────────────────────────────────────────────────────────┘

If "Try variations" selected:
┌─────────────────────────────────────────────────────────┐
│ Experiment Mode: "Wonderwall"                           │
│                                                         │
│ What if...                                              │
│ • Sarah takes lead vocals? (She knows it ⭐⭐⭐⭐)         │
│ • Emma adds rhythm guitar? (Basic chords ⭐⭐)           │
│ • Jake tries cajon instead of vocals? (New ⭐)          │
│                                                         │
│ [🎵 Try this arrangement] [💾 Save as alternate]        │
└─────────────────────────────────────────────────────────┘
```

---

## Journey Phase 3: Electric Show Planning

### ⚡ **Different Context, Different Casting**

#### **Step 1: Creating electric setlist (same songs, different roles)**
```
"Create New Setlist"
├── Name: "Electric Show - Main Stage"
├── Show Date: Next month
├── Venue: "Rock Palace"
├── Format: "Full Band Electric"
└── Expected Attendees: Sarah, Emma, Jake, Mike
```

#### **Step 2: Same song, completely different casting**
```
Adding "Wonderwall" to Electric Show setlist...

🎯 Casting for "Electric Show - Main Stage":
┌─────────────────────────────────────────────────────────┐
│ 🎵 Wonderwall - Oasis (Electric Version)                │
├─────────────────────────────────────────────────────────┤
│ Available Members: Sarah, Emma, Jake, Mike              │
│                                                         │
│ New Casting (vs. Acoustic):                            │
│ ┌─────────────────┬─────────────────┬─────────────────┐ │
│ │ Sarah          │ Emma            │ Mike            │ │
│ │ ☑️ Electric Guitar│ ☑️ Lead Vocals   │ ☑️ Bass Guitar   │ │
│ │ ☑️ Backup Vocals │ ☐ Tambourine    │ ☐ Backup Vocals │ │
│ │ ☐ Lead Guitar   │                 │                 │ │
│ └─────────────────┴─────────────────┴─────────────────┘ │
│ ┌─────────────────┐                                    │
│ │ Jake            │                                    │
│ │ ☑️ Drums         │                                    │
│ │ ☐ Backup Vocals │                                    │
│ └─────────────────┘                                    │
│                                                         │
│ 💡 Changes from Acoustic Version:                       │
│ • Sarah: Acoustic → Electric guitar + backup vocals    │
│ • Mike: Added on bass (wasn't in acoustic version)     │
│ • Jake: Backup vocals → Full drum kit                  │
│ • Emma: Same lead vocals but different arrangement     │
│                                                         │
│ [📋 Import from "Coffee Shop Acoustic"] [🎯 Auto-Cast] │
└─────────────────────────────────────────────────────────┘
```

#### **Step 3: Compare contexts side-by-side**
```
🎵 "Wonderwall" - Role Comparison

Coffee Shop Acoustic          Electric Show Main Stage
──────────────────────────────────────────────────────────
Sarah:                       Sarah:
• Acoustic Guitar ⭐⭐⭐⭐⭐      • Electric Guitar ⭐⭐⭐⭐
• (no vocals)                • Backup Vocals ⭐⭐⭐

Emma:                        Emma:
• Lead Vocals ⭐⭐⭐           • Lead Vocals ⭐⭐⭐⭐
• (no instrument)            • (no instrument)

Jake:                        Jake:
• Backup Vocals ⭐⭐          • Drums ⭐⭐⭐⭐⭐
• Light Percussion ⭐⭐⭐      • (no vocals)

Mike:                        Mike:
• (not performing)           • Bass Guitar ⭐⭐⭐⭐

💡 Smart Insights:
• Sarah's guitar skills transfer well between contexts
• Emma's vocals consistent across both versions
• Jake switches from vocals to his primary instrument (drums)
• Mike only needed for full band arrangement
```

---

## Schema Extensions Required

### 🗄️ **Database Schema Updates**

#### **New: Song Casting System**
```typescript
// Context-specific casting (NEW)
SongCasting {
  id: string
  contextType: 'setlist' | 'practice_session'
  contextId: string        // setlistId or practiceSessionId
  songId: string

  assignments: SongAssignment[]

  createdBy: string
  createdDate: Date
  lastModified: Date
}

// Individual member assignments (NEW)
SongAssignment {
  id: string
  songCastingId: string
  memberId: string

  roles: AssignmentRole[]   // Multiple roles per person

  confidence: 1 | 2 | 3 | 4 | 5
  notes?: string           // "Play intro solo, then switch to rhythm"
  isBackup: boolean        // Can cover if primary is absent
}

// Specific role assignments (NEW)
AssignmentRole {
  type: 'vocal' | 'instrument' | 'other'
  role: string             // "Lead Vocals", "Rhythm Guitar", "Tambourine"
  isPrimary: boolean       // Primary vs additional role
  arrangement?: string     // "Acoustic version", "Electric arrangement"
}
```

#### **Enhanced: Existing Models**
```typescript
// Update SetlistSong to reference casting
SetlistSong {
  songId: string
  order: number
  transitionNotes?: string
  keyChange?: string
  tempoChange?: number
  specialInstructions?: string

  // NEW: Link to casting information
  songCastingId?: string   // References SongCasting table
}

// Update SessionSong to reference casting
SessionSong {
  songId: string
  timeSpent: number
  status: SongStatus
  notes?: string
  sectionsWorked: string[]
  improvements: string[]
  needsWork: string[]
  memberRatings: MemberRating[]

  // NEW: Link to casting information
  songCastingId?: string   // References SongCasting table

  // NEW: Practice-specific role notes
  roleNotes: RolePracticeNote[]
}

// NEW: Track practice progress per role
RolePracticeNote {
  memberId: string
  role: string             // "Lead Guitar", "Backup Vocals"
  confidence: 1 | 2 | 3 | 4 | 5
  needsWork: string[]      // "Timing on verse", "Key change transition"
  improvements: string[]   // "Nailed the solo", "Harmony sounds great"
}
```

---

## User Experience Features

### 🎯 **Smart Casting Suggestions**

#### **Auto-Cast Based on:**
```typescript
function suggestCasting(song: Song, context: SetlistOrPractice, members: Member[]) {
  const suggestions = []

  // Check member experience with this song
  members.forEach(member => {
    const personalVersion = member.personalSongs.find(s => s.linkedToSong(song))
    if (personalVersion) {
      suggestions.push({
        member: member.id,
        role: personalVersion.myInstrument,
        confidence: personalVersion.confidence,
        reason: `Has experience with this song (${personalVersion.confidence}/5)`
      })
    }
  })

  // Check instruments available
  const contextInstruments = context.availableInstruments || getDefaultInstruments(context.format)
  members.forEach(member => {
    member.instruments.forEach(instrument => {
      if (contextInstruments.includes(instrument)) {
        suggestions.push({
          member: member.id,
          role: instrument,
          confidence: member.getInstrumentSkill(instrument),
          reason: `Plays ${instrument}`
        })
      }
    })
  })

  return suggestions
}
```

#### **Cross-Context Learning:**
```
🎯 Casting Insights:

"Based on Sarah's acoustic guitar performance in the Coffee Shop setlist,
she might be ready to try electric guitar for this song.
Her fingerpicking skills will transfer well to electric picking patterns."

Suggestion: Assign Sarah to Electric Guitar (⭐⭐⭐⭐ predicted confidence)
```

### 📱 **Mobile Casting Interface**

#### **Quick Role Assignment:**
```
┌─────────────────────────────────────────────────────────┐
│ 🎵 Wonderwall - Quick Cast                              │
├─────────────────────────────────────────────────────────┤
│ 👤 Sarah                                                │
│ [🎸 Guitar] [🎤 Lead Vocal] [🎵 Backup] [+ Add Role]    │
│                                                         │
│ 👤 Emma                                                 │
│ [🎤 Lead Vocal] [🎸 Guitar] [🎵 Backup] [+ Add Role]    │
│                                                         │
│ 👤 Jake                                                 │
│ [🥁 Drums] [🎵 Backup] [🎸 Guitar] [+ Add Role]         │
│                                                         │
│ [💾 Save] [📋 Copy from Other Setlist] [🎯 Auto-Cast]   │
└─────────────────────────────────────────────────────────┘
```

#### **During Performance - Role Switching:**
```
🎵 Live: "Wonderwall"
Current: Sarah (Guitar), Emma (Vocals), Jake (Backup)

⚠️ Emma's mic issues!
Quick switch options:
• Sarah → Lead Vocals (⭐⭐⭐⭐ backup singer)
• Jake → Lead Vocals (⭐⭐ can cover)

[🔄 Switch Sarah to Lead] [👥 Show All Options]
```

---

## Validation Against Current Schema

### ✅ **What Works With Current System:**
- **Member instruments:** `Member.instruments[]` provides foundation for role options
- **Setlist structure:** `Setlist.songs[]` can be extended with casting references
- **Practice tracking:** `SessionSong.memberRatings[]` aligns with role-specific confidence tracking
- **Band context:** `bandId` in setlists/sessions provides context boundaries

### 🔧 **Required Extensions:**
- **New tables:** `SongCasting`, `SongAssignment`, `AssignmentRole`
- **Foreign key links:** Add `songCastingId` to `SetlistSong` and `SessionSong`
- **Role practice tracking:** Extend `SessionSong` with role-specific notes and progress

### 🚫 **Current Limitations:**
- **No casting system:** Currently no way to assign roles to specific songs in context
- **Static member roles:** `Member.role` is band-level, not song/context-level
- **No multi-role support:** Can't handle someone doing vocals AND guitar simultaneously
- **No context switching:** Same song can't have different assignments in different setlists

---

## Implementation Priority

### 🚀 **Phase 1: Basic Casting (Days 1-2)**
- Add `SongCasting` and `SongAssignment` tables
- Basic setlist casting interface (one role per person)
- Simple casting inheritance from setlist to practice

### 🎯 **Phase 2: Multi-Role Support (Days 3-4)**
- Support multiple roles per person per song
- Role-specific confidence tracking and notes
- Cross-context casting comparison

### ⚡ **Phase 3: Smart Features (Days 5-6)**
- Auto-casting suggestions based on member experience
- Cross-setlist casting templates and copying
- Real-time role switching during practice/performance

This system transforms static "who plays what" into dynamic, context-aware collaboration that matches how real bands actually work!