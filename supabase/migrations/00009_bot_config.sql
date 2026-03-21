-- Phase 4: Bot configuration columns for personality and guardrails

-- Personality fields
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS greeting_en        text,
  ADD COLUMN IF NOT EXISTS greeting_bm        text,
  ADD COLUMN IF NOT EXISTS greeting_zh        text,
  ADD COLUMN IF NOT EXISTS tone               text DEFAULT 'Professional'
                                              CHECK (tone IN ('Professional', 'Friendly', 'Formal')),
  ADD COLUMN IF NOT EXISTS fallback_message   text;

-- Guardrails fields
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS blocked_keywords       text,
  ADD COLUMN IF NOT EXISTS refuse_message         text,
  ADD COLUMN IF NOT EXISTS disclaimer_text        text,
  ADD COLUMN IF NOT EXISTS max_response_length    integer DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS off_topic_message      text;
