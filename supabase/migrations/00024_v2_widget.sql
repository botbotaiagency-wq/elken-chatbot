-- ============================================================
-- MIGRATION: 00024_v2_widget.sql
-- Web widget configuration per bot
-- ============================================================

CREATE TABLE IF NOT EXISTS widget_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE UNIQUE,
  primary_color TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#ffffff',
  font_family TEXT DEFAULT 'Inter',
  bubble_style TEXT DEFAULT 'rounded' CHECK (bubble_style IN ('rounded','sharp','pill')),
  position TEXT DEFAULT 'bottom-right' CHECK (position IN ('bottom-right','bottom-left')),
  welcome_message TEXT,
  placeholder_text TEXT DEFAULT 'Type a message...',
  quick_replies JSONB DEFAULT '[]', -- [{label: "...", message: "..."}]
  allowed_domains TEXT[] DEFAULT '{}',
  show_branding BOOLEAN DEFAULT TRUE,
  custom_css TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE widget_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on widget_configs"
  ON widget_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public read for widget loader script (no auth needed)
CREATE POLICY "Public read widget_configs"
  ON widget_configs FOR SELECT
  TO anon
  USING (true);
