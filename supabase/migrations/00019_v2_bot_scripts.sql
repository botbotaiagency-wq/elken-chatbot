-- ============================================================
-- MIGRATION: 00019_v2_bot_scripts.sql
-- Visual Flow Builder scripts (ReactFlow-based)
-- Note: distinct from v1 'scripts' table (plain-text sales scripts)
-- ============================================================

CREATE TABLE IF NOT EXISTS bot_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT DEFAULT 'keyword' CHECK (trigger_type IN ('keyword','intent','always','manual','api')),
  trigger_value TEXT, -- keyword or intent name
  flow_data JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}', -- ReactFlow schema
  is_active BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_scripts_bot_id ON bot_scripts(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_scripts_active ON bot_scripts(bot_id, is_active);

-- Script versions for rollback
CREATE TABLE IF NOT EXISTS bot_script_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES bot_scripts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  flow_data JSONB NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_script_versions_script_id ON bot_script_versions(script_id);

ALTER TABLE bot_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_script_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bot_scripts"
  ON bot_scripts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on bot_script_versions"
  ON bot_script_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
