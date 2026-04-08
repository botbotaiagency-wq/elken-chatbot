-- ============================================================
-- MIGRATION: 00023_v2_sentiment.sql
-- Add sentiment tracking to messages and pipeline debug storage
-- ============================================================

-- Sentiment per message
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative','frustrated'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sentiment_score FLOAT;

-- Pipeline debug data (10-step debug log per bot message)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pipeline_debug JSONB;
