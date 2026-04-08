-- ============================================================
-- MIGRATION: 00021_v2_agents.sql
-- Agent profiles and live agent takeover sessions
-- ============================================================

-- Agent profiles (tenant admin users with agent role)
CREATE TABLE IF NOT EXISTS agent_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bot_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_bot_id ON agent_profiles(bot_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_user_id ON agent_profiles(user_id);

-- Live agent takeover sessions
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  bot_id UUID NOT NULL REFERENCES bots(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_conversation_id ON agent_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_bot_id ON agent_sessions(bot_id, is_active);

ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agent_profiles"
  ON agent_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on agent_sessions"
  ON agent_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
