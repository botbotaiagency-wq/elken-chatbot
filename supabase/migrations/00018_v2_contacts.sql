-- ============================================================
-- MIGRATION: 00018_v2_contacts.sql
-- CRM Contacts — auto-created from conversations
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  external_id TEXT, -- WhatsApp number / Telegram user_id / email / session_id
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  name TEXT,
  phone TEXT,
  email TEXT,
  language TEXT DEFAULT 'en',
  tags TEXT[] DEFAULT '{}',
  lead_stage TEXT DEFAULT 'new' CHECK (lead_stage IN ('new','engaged','qualified','booked','converted','churned')),
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  custom_fields JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  total_messages INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  notes TEXT,
  assigned_agent_id UUID REFERENCES auth.users(id),
  opt_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, external_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_contacts_bot_id ON contacts(bot_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_stage ON contacts(bot_id, lead_stage);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_last_message_at ON contacts(bot_id, last_message_at DESC);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on contacts"
  ON contacts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Link contacts to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);
