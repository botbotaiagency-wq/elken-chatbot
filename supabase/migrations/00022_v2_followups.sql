-- ============================================================
-- MIGRATION: 00022_v2_followups.sql
-- Follow-up rules and queue for re-engagement automation
-- ============================================================

-- Follow-up rules
CREATE TABLE IF NOT EXISTS followup_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  -- 'no_reply_Xh', 'no_booking_after_enquiry', 'booking_no_show', 'post_booking'
  trigger_hours INTEGER, -- for time-based triggers
  message_template TEXT NOT NULL,
  max_attempts INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_rules_bot_id ON followup_rules(bot_id, is_active);

-- Follow-up queue
CREATE TABLE IF NOT EXISTS followup_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES followup_rules(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id),
  attempt_count INTEGER DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','completed','failed','cancelled')),
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_queue_bot_id ON followup_queue(bot_id, status);
CREATE INDEX IF NOT EXISTS idx_followup_queue_next_attempt ON followup_queue(status, next_attempt_at);

ALTER TABLE followup_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on followup_rules"
  ON followup_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on followup_queue"
  ON followup_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
