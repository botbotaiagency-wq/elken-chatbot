-- Analytics RPC functions for aggregate queries
-- All functions use SECURITY DEFINER so service role can call them bypassing RLS

-- get_message_volume: daily message counts by channel
CREATE OR REPLACE FUNCTION public.get_message_volume(
  p_bot_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (day date, channel text, count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    (m.created_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date AS day,
    c.channel,
    COUNT(*) AS count
  FROM messages m
  JOIN conversations c ON m.conversation_id = c.id
  WHERE m.bot_id = p_bot_id
    AND m.created_at >= p_from
    AND m.created_at <= p_to
    AND m.role = 'user'
  GROUP BY 1, 2
  ORDER BY 1;
$$;

-- get_intent_breakdown: user message counts grouped by intent
CREATE OR REPLACE FUNCTION public.get_intent_breakdown(
  p_bot_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (intent text, count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(intent, 'general') AS intent,
    COUNT(*) AS count
  FROM messages
  WHERE bot_id = p_bot_id
    AND created_at >= p_from
    AND created_at <= p_to
    AND role = 'user'
  GROUP BY 1
  ORDER BY count DESC;
$$;

-- get_unanswered_queries: messages where RAG found no match, grouped by content
CREATE OR REPLACE FUNCTION public.get_unanswered_queries(
  p_bot_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (content text, frequency bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT content, COUNT(*) AS frequency
  FROM messages
  WHERE bot_id = p_bot_id
    AND rag_found = false
    AND role = 'user'
    AND created_at >= p_from
    AND created_at <= p_to
  GROUP BY content
  ORDER BY frequency DESC
  LIMIT 100;
$$;

-- get_latency_stats: p50 and p95 response latency for assistant messages
CREATE OR REPLACE FUNCTION public.get_latency_stats(
  p_bot_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'p50', ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)),
    'p95', ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))
  )
  FROM messages
  WHERE bot_id = p_bot_id
    AND created_at BETWEEN p_from AND p_to
    AND role = 'assistant'
    AND latency_ms IS NOT NULL;
$$;

-- get_booking_funnel: conversion funnel from enquiry to attended
CREATE OR REPLACE FUNCTION public.get_booking_funnel(
  p_bot_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'enquiries', (
      SELECT COUNT(*)
      FROM messages
      WHERE bot_id = p_bot_id
        AND intent = 'book_session'
        AND role = 'user'
        AND created_at BETWEEN p_from AND p_to
    ),
    'submitted', (
      SELECT COUNT(*)
      FROM bookings
      WHERE bot_id = p_bot_id
        AND created_at BETWEEN p_from AND p_to
    ),
    'confirmed', (
      SELECT COUNT(*)
      FROM bookings
      WHERE bot_id = p_bot_id
        AND status IN ('confirmed', 'walk_in')
        AND created_at BETWEEN p_from AND p_to
    ),
    'attended', (
      SELECT COUNT(*)
      FROM bookings
      WHERE bot_id = p_bot_id
        AND status IN ('confirmed', 'walk_in')
        AND session_start < NOW()
        AND created_at BETWEEN p_from AND p_to
    )
  );
$$;
