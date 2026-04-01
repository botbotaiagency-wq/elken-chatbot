-- Fix 1: Custom system prompt per bot
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS system_prompt text;

-- Fix 2: Q&A parse mode for documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS parse_mode text NOT NULL DEFAULT 'chunks'
  CHECK (parse_mode IN ('chunks', 'qna'));

-- Track which FAQs were generated from a script upload (for cascade delete)
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE;

-- Fix 4: Google Calendar integration per bot
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS google_calendar_id text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS google_calendar_event_id text;
