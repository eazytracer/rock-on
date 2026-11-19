# Redesign launch to-do

Manual steps the code can't do: settings on the hosted Supabase project (or elsewhere) that must change when the
redesign ships. Add to this list as phases need them; tick items off when done.

## Hosted Supabase (Authentication settings)

- [ ] **Password minimum length → 8** (Phase 6 decision 4). Local `supabase/config.toml` is set to match; the client
      requires 8. Existing shorter passwords keep working; the rule applies when a password is set or changed.
