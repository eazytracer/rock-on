-- Test: songs.linked_from_song_id
-- Purpose: The personal-catalog copy of a band song records its origin in
--          songs.linked_from_song_id (drives the "mirrored"/chain-icon state
--          and source-band label). Before Phase 2 this lived only in IndexedDB.
-- Category: Schema
-- Created: 2026-10-25

begin;

select plan(3);

select has_column('public', 'songs', 'linked_from_song_id',
  'songs has linked_from_song_id');

select col_type_is('public', 'songs', 'linked_from_song_id', 'uuid',
  'linked_from_song_id is a uuid');

select fk_ok('public', 'songs', 'linked_from_song_id', 'public', 'songs', 'id',
  'linked_from_song_id references songs(id)');

select * from finish();

rollback;
