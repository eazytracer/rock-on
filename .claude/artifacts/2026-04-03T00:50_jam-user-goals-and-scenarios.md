# Jam Session — User Goals & Scenarios

**Created:** 2026-04-03T00:50  
**Purpose:** Ground the jam session UX in actual user intent before designing flows. This document asks "what does the user want to achieve?" before asking "how do they do it?"

---

## The Core User Problem

Musicians know songs. When they meet other musicians, they don't know what the other person knows. Today, figuring out what to play together is done entirely in people's heads — "do you know this one?" repeated ten times while someone tunes. It's slow, incomplete, and you always forget the song you both know until halfway through the night.

Rock On's jam session feature exists to solve this. But the solution has to work for a wide range of situations, not just one.

---

## Who Is At the Jam

### The Connected Musician (registered user with catalog)

Has been using the app. Has songs in their personal catalog — maybe 20, maybe 200. Shows up somewhere and wants to instantly find common ground with whoever else is there. This person gets the most value but also represents the smallest slice of users at any given jam.

### The New Arrival (new or lapsed user, no catalog yet)

Interested in the app, heard about it, just installed it, or hasn't logged in for months. Wants to participate but has an empty catalog. The experience needs to let them add songs fast — in the parking lot, between sets. If this feels like homework, they leave.

### The Guest (no account, joined via link/code)

Someone handed them a phone or texted them a link. They have no account and no interest in creating one right now. They want to see what's happening and maybe throw in a song idea. This person is the audience for the app's best marketing moment — if the experience is good, they sign up.

### The Host (registered, created the session)

Might be a regular organizer, a band leader at an open mic, or just the person who pulled out their phone first. Responsible for creating the session, keeping it moving, and ultimately deciding what gets played. Has final say on the setlist.

---

## What Users Actually Want to Achieve

These are goals, not features. Every UI decision should trace back to one of these.

---

### Goal 1: "Figure out what we can all play right now"

**The situation:** A small group of musicians just met (or just decided to play together). They have 20 minutes before they need to start. They need a setlist.

**What they want:**

- A fast, low-friction way to say "here are songs I know"
- To instantly see what songs overlap across the group
- A short, playable list — not a research project

**What they don't want:**

- To spend 10 minutes entering data before anything useful happens
- To navigate through settings or band management screens
- To create an account before they can contribute anything

**Success looks like:** Within 5 minutes of someone opening the app, the group has a list of songs they can all play.

**Key tension:** The more songs someone has in their catalog, the more useful matching is. But adding songs takes time. The app needs a fast-path for this moment specifically — searching for songs and quick-adding them, not the full song management flow.

---

### Goal 2: "Build a set from what we found"

**The situation:** The matching found 12 songs everyone knows. Now someone needs to turn that into an ordered, playable set for tonight.

**What they want:**

- To see all the common songs in one place
- To pick and arrange the ones they actually want to play
- To add songs that aren't in anyone's catalog yet ("we all know Wonderwall even if it's not in the app")
- To be able to say "skip this one, let's do that one instead"

**What they don't want:**

- A read-only list they can't act on
- To lose the work if the phone screen turns off
- Suggestions as a separate thing from the setlist — they want to build one thing

**Success looks like:** The host (or group) can produce an ordered setlist directly from the jam session, mixing matched songs with songs they nominated on the spot.

---

### Goal 3: "Let others suggest songs"

**The situation:** Not everyone in the group should have full control, but anyone should be able to say "what about this song?"

**What participants want:**

- To nominate a song for consideration
- To see if others can play it (ideally the app already knows)
- To not feel like a passive observer while the host decides everything

**What the host wants:**

- To see nominations without losing control of the final list
- A clear "host approves" vs "participant suggests" separation
- To not have the setlist turn into chaos with 5 people editing at once

**Success looks like:** Participants can nominate songs that appear in a queue for the host to accept or skip. The host's setlist is the output.

---

### Goal 4: "Save this so we can do it again"

**The situation:** The jam went well. This group wants to meet again. Or this setlist is just really good and they want to keep it.

**What they want:**

- The setlist saved in a findable place
- To know who was in the session so they can reconnect
- Ideally, a way to restart a session with the same group

**What they don't want:**

- To have to manually recreate the setlist
- The session to disappear after 24 hours with no way to recover it

**Success looks like:** After the jam, one tap saves the setlist to the host's (and optionally each participant's) catalog. The session record is accessible later.

---

### Goal 5: "Bring in songs we don't have in the app yet"

**The situation:** Someone knows a song that isn't in the app. Or the group wants to try something new that nobody has officially "added" to their catalog.

**What they want:**

- A fast way to search for a song and add it to the session
- That song to behave like any other — it can be matched, added to the setlist, saved
- To optionally add it to their personal catalog for future jams

**What they don't want:**

- A multi-step add flow that interrupts the momentum of the jam
- To have to fill in BPM, key, difficulty, etc. just to say "I know this song"

**Success looks like:** A song search with one-tap "add to session" that doesn't require filling out a full song form.

---

### Goal 6: "Show the audience what we're playing"

**The situation:** The host wants to display the setlist on a screen, or share it with people in the room who aren't in the app.

**What they want:**

- A shareable link to a view-only setlist
- No login required to view
- Something that looks good on a phone screen across the room

**What they don't want:**

- The audience to need to download the app just to see the setlist

**Success looks like:** The host shares a link. Non-users see a clean, real-time setlist view. They can see what's coming next.

---

### Goal 7: "Find people to jam with" _(lower priority, future)_

**The situation:** A musician shows up somewhere without a group. Or they want to find other musicians in their area who know the same songs.

This goal exists but is out of scope for the current jam session feature. It points toward a future social/discovery layer. Noted here so we don't accidentally build toward it prematurely.

---

## The Anonymous User Experience (Retention Opportunity)

Anonymous users arrive at the app one of two ways:

1. Someone sent them a session link
2. Someone showed them the session code and they went to the join page

In both cases, the anonymous user is at a live jam. They're curious. They're already socially invested in the outcome. **This is the highest-conversion moment in the entire app.**

### What the anonymous experience should do

**Show them something genuinely useful immediately.** They should see the session name, who's in it, and the current song list or common matches. Not a login wall. Not a marketing page.

**Let them see the value before asking for anything.** The list of common songs IS the pitch. "These five people all know these twelve songs" is immediately interesting.

**Give them a clear, low-ask upgrade path.** Not "sign up to see more." But rather: "Want your songs in the mix? Sign up — we'll add your catalog and recompute the matches in 30 seconds."

**Make the account creation as fast as possible in this context.** The jam-signup flow should be distinct from the standard onboarding. Skip the band creation step. Go straight to "search for songs you know and add them." The band can come later.

### What the anonymous experience should NOT do

- Show a blank/error page if the session is still active
- Require an account to see the current setlist
- Redirect to the homepage with no context
- Show the full app navigation when they're clearly here for one specific thing

---

## How Goals Map to the Current Feature

| User Goal                    | Current State                              | Gap                                 |
| ---------------------------- | ------------------------------------------ | ----------------------------------- |
| Find common songs            | ✅ Works (after our fixes)                 | Fast song-add flow missing          |
| Build a set from matches     | ❌ Common songs are read-only              | Setlist builder in session needed   |
| Let others suggest songs     | ❌ No nomination system                    | Participant nomination queue needed |
| Save the setlist             | ⚠️ "Save as Setlist" exists for host       | Participants can't save their copy  |
| Add songs not in the app     | ⚠️ Only from personal catalog              | In-session song search needed       |
| Show audience the setlist    | ⚠️ View page exists but shows matches only | Setlist broadcast not implemented   |
| Anonymous join → account CTA | ⚠️ CTA exists but flow is rough            | Fast jam-signup onboarding needed   |

---

## Priority Order for UX Work

Based on the goal gap analysis above, here's what to build next in order of user-facing impact:

**1. In-session setlist builder (host)**  
Transform "Common Songs" from a read-only panel into a drag-to-setlist workspace. The host picks songs from the match list, adds them to an ordered set, can reorder. This makes Goal 2 real.

**2. Fast song-add flow (in-session)**  
From within the jam session, any participant can search for a song and add it to their personal catalog without leaving the session. This addresses Goal 5 and also improves matching for Goals 1 and 3.

**3. Participant nomination queue**  
Participants can tap any song (from their catalog or search) to "nominate" it. It shows up in a queue for the host to accept or pass. Accepted songs move to the setlist. This addresses Goal 3.

**4. Setlist broadcast (view page)**  
The public view page shows the _setlist_ (host-curated), not just the raw match list. Updates live as the host adds songs. This addresses Goal 6.

**5. Anonymous → account fast-path**  
Dedicated post-join signup flow: skip band creation, go straight to "add songs you know" with a fast search interface. This addresses the retention opportunity in the anonymous experience.

**6. Save + reconnect**  
After a session ends or is saved, each participant can save the setlist to their own catalog. The session is linkable/reusable. This addresses Goal 4.

---

## Design Principles for All Jam UX

**Speed over completeness.** A song added in 10 seconds beats a perfectly-tagged song added in 3 minutes. In-session flows should favor fast over thorough. Full song management can happen later.

**Host controls, participants contribute.** Clear separation of roles. The host's decisions are final. But participants aren't passive — they can suggest, nominate, and influence.

**The app works before signup, works better with it.** Anonymous users see real content. Registered users add to it. The delta between the two experiences should be obvious and desirable, not hidden behind a wall.

**Jam sessions are ephemeral; setlists are permanent.** Sessions expire. That's fine. But the output (a setlist) should be saveable and should outlive the session. Users should never feel like their work disappears.

**One screen for the whole evening.** The host should be able to run an entire jam night from the session page without navigating elsewhere. Everything — matching, building, broadcasting — happens in one place.
