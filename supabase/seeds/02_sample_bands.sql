-- Rock On Sample Bands
-- Seed file: Sample bands and memberships for development and testing
-- Created: 2025-10-25

-- Insert sample bands
INSERT INTO public.bands (id, name, description, created_date, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Motörhead', 'Legendary rock and roll band', '2024-01-01 10:00:00+00', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Foo Fighters', 'Rock band from Seattle', '2024-01-02 10:00:00+00', true);

-- Insert band memberships for Motörhead
INSERT INTO public.band_memberships (user_id, band_id, role, permissions, joined_date, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', ARRAY['admin', 'member'], '2024-01-01 10:00:00+00', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member', ARRAY['member'], '2024-01-03 10:00:00+00', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member', ARRAY['member'], '2024-01-04 10:00:00+00', 'active');

-- Insert band memberships for Foo Fighters
INSERT INTO public.band_memberships (user_id, band_id, role, permissions, joined_date, status) VALUES
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin', ARRAY['admin', 'member'], '2024-01-02 10:00:00+00', 'active'),
  ('55555555-5555-5555-5555-555555555555', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member', ARRAY['member'], '2024-01-05 10:00:00+00', 'active'),
  ('66666666-6666-6666-6666-666666666666', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member', ARRAY['member'], '2024-01-06 10:00:00+00', 'active'),
  ('77777777-7777-7777-7777-777777777777', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member', ARRAY['member'], '2024-01-07 10:00:00+00', 'active');

-- Insert member capabilities for Motörhead
INSERT INTO public.member_capabilities (user_id, band_id, role_type, proficiency_level, is_primary) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bass', 5, true),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'vocals', 5, false),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'guitar', 5, true),
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'drums', 5, true);

-- Insert member capabilities for Foo Fighters
INSERT INTO public.member_capabilities (user_id, band_id, role_type, proficiency_level, is_primary) VALUES
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'drums', 5, true),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'guitar', 5, false),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'vocals', 5, false),
  ('55555555-5555-5555-5555-555555555555', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'drums', 5, true),
  ('55555555-5555-5555-5555-555555555555', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'vocals', 4, false),
  ('66666666-6666-6666-6666-666666666666', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bass', 5, true),
  ('77777777-7777-7777-7777-777777777777', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'guitar', 5, true),
  ('77777777-7777-7777-7777-777777777777', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'vocals', 4, false);
