-- ============================================================
-- MIGRATION: 00025_v2_tenant_onboarding.sql
-- Tenant invite tokens and onboarding progress tracker
-- ============================================================

-- Tenant invite tokens
CREATE TABLE IF NOT EXISTS tenant_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'tenant_admin' CHECK (role IN ('tenant_admin','agent')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_token ON tenant_invites(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON tenant_invites(email);

-- Onboarding progress tracker
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  steps_completed JSONB DEFAULT '{"create_bot":false,"upload_doc":false,"configure_personality":false,"connect_channel":false,"test_bot":false}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on tenant_invites"
  ON tenant_invites FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on onboarding_progress"
  ON onboarding_progress FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anon read of invite by token (for invite acceptance page)
CREATE POLICY "Public read tenant_invites by token"
  ON tenant_invites FOR SELECT
  TO anon
  USING (true);
