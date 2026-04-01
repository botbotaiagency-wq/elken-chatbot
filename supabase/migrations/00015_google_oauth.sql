-- Per-bot Google OAuth tokens for Calendar integration
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS google_oauth_access_token  text,
  ADD COLUMN IF NOT EXISTS google_oauth_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_oauth_token_expiry  timestamptz,
  ADD COLUMN IF NOT EXISTS google_oauth_email         text;   -- connected Google account email
