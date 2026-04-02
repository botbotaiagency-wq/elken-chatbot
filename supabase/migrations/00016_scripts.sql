-- Add 'script' as a valid parse_mode on documents
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_parse_mode_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_parse_mode_check
  CHECK (parse_mode IN ('chunks', 'qna', 'script'));

-- Scripts table: stores full extracted text for system prompt injection
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scripts_bot_id_idx ON scripts(bot_id);
CREATE INDEX scripts_bot_id_active_idx ON scripts(bot_id, is_active);

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on scripts"
  ON scripts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
