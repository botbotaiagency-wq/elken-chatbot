-- ============================================================
-- MIGRATION: 00020_v2_broadcasts.sql
-- Broadcast campaigns, recipients, and drip sequences
-- ============================================================

-- Broadcast campaigns
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message_template JSONB NOT NULL, -- {body, media_url?, buttons?[]}
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  audience_filter JSONB DEFAULT '{}', -- {tags?, lead_stage?, language?, last_active_days?}
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  stats JSONB DEFAULT '{"total":0,"sent":0,"delivered":0,"read":0,"replied":0,"failed":0}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_bot_id ON broadcast_campaigns(bot_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON broadcast_campaigns(status, scheduled_at);

-- Broadcast recipients (resolved at send time)
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','replied','failed','opted_out')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign_id ON broadcast_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_contact_id ON broadcast_recipients(contact_id);

-- Drip sequences
CREATE TABLE IF NOT EXISTS drip_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('contact_created','lead_stage_change','booking_confirmed','no_reply','manual')),
  trigger_value TEXT, -- e.g. lead stage value
  steps JSONB NOT NULL DEFAULT '[]',
  -- steps: [{day: 1, message: "...", channel: "whatsapp"}, ...]
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drip_sequences_bot_id ON drip_sequences(bot_id);

ALTER TABLE broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on broadcast_campaigns"
  ON broadcast_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on broadcast_recipients"
  ON broadcast_recipients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on drip_sequences"
  ON drip_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);
