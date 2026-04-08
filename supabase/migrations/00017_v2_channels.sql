-- ============================================================
-- MIGRATION: 00017_v2_channels.sql
-- Channel configurations per bot (WhatsApp, Telegram, Web Widget, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS channel_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'web_widget', 'instagram', 'facebook')),
  is_active BOOLEAN DEFAULT FALSE,
  config JSONB DEFAULT '{}',
  -- WhatsApp: phone_number_id, access_token (encrypted), verify_token, waba_id
  -- Telegram: bot_token (encrypted), bot_username
  -- Web Widget: allowed_domains[], theme_config
  webhook_url TEXT,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_channel_configs_bot_id ON channel_configs(bot_id);

ALTER TABLE channel_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on channel_configs"
  ON channel_configs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
