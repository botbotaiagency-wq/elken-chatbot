-- Phase 5: Booking System Schema
-- Creates facilities_config table, bookings table, RPC functions, indexes, and RLS policies

-- ============================================================
-- 1. facilities_config table (per-facility-type config per bot)
-- ============================================================

CREATE TABLE public.facilities_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id              uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  facility_type       text NOT NULL CHECK (facility_type IN (
                        'bed_female', 'bed_male', 'bed_unisex',
                        'inhaler', 'room_small', 'room_large'
                      )),
  capacity            integer NOT NULL DEFAULT 1,
  duration_minutes    integer NOT NULL DEFAULT 60,
  min_advance_hours   integer NOT NULL DEFAULT 2,
  max_window_days     integer NOT NULL DEFAULT 30,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (bot_id, facility_type)
);

-- ============================================================
-- 2. bookings table
-- ============================================================

CREATE TABLE public.bookings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id               uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  facility_type        text NOT NULL,
  location             text NOT NULL CHECK (location IN ('okr', 'subang')),
  session_start        timestamptz NOT NULL,
  session_end          timestamptz NOT NULL,
  customer_name        text NOT NULL,
  member_id            text,
  contact_number       text NOT NULL,
  is_member            boolean NOT NULL DEFAULT false,
  has_bes_device       boolean,
  on_loan_unit         text,
  customer_gender      text CHECK (customer_gender IN ('male', 'female')),
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show', 'walk_in')),
  user_id              text,
  channel              text,
  conversation_id      uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  audit_log            jsonb NOT NULL DEFAULT '[]'::jsonb,
  reminder_sent        boolean NOT NULL DEFAULT false,
  reminder_sent_at     timestamptz,
  reminder_retry_count integer NOT NULL DEFAULT 0,
  survey_sent          boolean NOT NULL DEFAULT false,
  survey_sent_at       timestamptz,
  survey_retry_count   integer NOT NULL DEFAULT 0,
  survey_response      jsonb,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Add n8n_outbound_webhook column to bots
-- ============================================================

ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS n8n_outbound_webhook text;

-- ============================================================
-- 4. Indexes
-- ============================================================

CREATE INDEX idx_bookings_bot_id ON public.bookings(bot_id);
CREATE INDEX idx_bookings_session_start ON public.bookings(session_start);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_reminder ON public.bookings(reminder_sent, status, session_start)
  WHERE reminder_sent = false AND status = 'confirmed';
CREATE INDEX idx_bookings_survey ON public.bookings(survey_sent, status, session_start)
  WHERE survey_sent = false AND status IN ('confirmed', 'walk_in');
CREATE INDEX idx_facilities_config_bot ON public.facilities_config(bot_id);

-- ============================================================
-- 5. RLS policies
-- ============================================================

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities_config ENABLE ROW LEVEL SECURITY;

-- bookings: tenant-scoped SELECT
CREATE POLICY "bookings_tenant_isolation" ON public.bookings
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_super_admin())
    OR bot_id IN (
      SELECT b.id FROM public.bots b
      WHERE b.tenant_id = (SELECT public.jwt_tenant_id())
    )
  )
  WITH CHECK (
    (SELECT public.is_super_admin())
    OR bot_id IN (
      SELECT b.id FROM public.bots b
      WHERE b.tenant_id = (SELECT public.jwt_tenant_id())
    )
  );

-- facilities_config: tenant-scoped SELECT
CREATE POLICY "facilities_config_tenant_isolation" ON public.facilities_config
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_super_admin())
    OR bot_id IN (
      SELECT b.id FROM public.bots b
      WHERE b.tenant_id = (SELECT public.jwt_tenant_id())
    )
  )
  WITH CHECK (
    (SELECT public.is_super_admin())
    OR bot_id IN (
      SELECT b.id FROM public.bots b
      WHERE b.tenant_id = (SELECT public.jwt_tenant_id())
    )
  );

-- ============================================================
-- 6. check_and_create_booking RPC
--    Atomically checks slot capacity (with SELECT FOR UPDATE),
--    enforces gender conflict for unisex beds, and inserts booking.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_and_create_booking(
  p_bot_id        uuid,
  p_facility_type text,
  p_location      text,
  p_session_start timestamptz,
  p_session_end   timestamptz,
  p_customer_name text,
  p_member_id     text,
  p_contact       text,
  p_is_member     boolean,
  p_has_bes       boolean,
  p_gender        text,   -- 'male' | 'female' | null
  p_status        text    -- 'pending' | 'walk_in'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config     record;
  v_count      integer;
  v_booking_id uuid;
BEGIN
  -- Lock the facilities_config row to prevent concurrent inserts for same slot
  SELECT * INTO v_config
  FROM public.facilities_config
  WHERE bot_id = p_bot_id AND facility_type = p_facility_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_config');
  END IF;

  -- Count existing confirmed/pending/walk_in bookings in this slot
  SELECT COUNT(*) INTO v_count
  FROM public.bookings
  WHERE bot_id = p_bot_id
    AND facility_type = p_facility_type
    AND location = p_location
    AND session_start = p_session_start
    AND status IN ('pending', 'confirmed', 'walk_in');

  IF v_count >= v_config.capacity THEN
    RETURN jsonb_build_object('success', false, 'reason', 'slot_full');
  END IF;

  -- Unisex Bed gender conflict check (BOOK-13)
  IF p_facility_type = 'bed_unisex' AND p_gender IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bot_id = p_bot_id
        AND facility_type = 'bed_unisex'
        AND location = p_location
        AND session_start = p_session_start
        AND status IN ('pending', 'confirmed', 'walk_in')
        AND customer_gender != p_gender
    ) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'gender_conflict');
    END IF;
  END IF;

  INSERT INTO public.bookings (
    bot_id, facility_type, location, session_start, session_end,
    customer_name, member_id, contact_number, is_member, has_bes_device,
    customer_gender, status, audit_log
  ) VALUES (
    p_bot_id, p_facility_type, p_location, p_session_start, p_session_end,
    p_customer_name, p_member_id, p_contact, p_is_member, p_has_bes,
    p_gender, p_status,
    jsonb_build_array(
      jsonb_build_object(
        'action', 'created',
        'by', 'bot',
        'at', now()::text,
        'note', 'Booking submitted via chatbot'
      )
    )
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id);
END;
$$;

-- ============================================================
-- 7. update_booking_status RPC
--    Atomically changes status and appends an audit log entry.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id uuid,
  p_bot_id     uuid,
  p_action     text,
  p_staff_name text,
  p_note       text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_status text;
BEGIN
  CASE p_action
    WHEN 'confirm'  THEN v_new_status := 'confirmed';
    WHEN 'cancel'   THEN v_new_status := 'cancelled';
    WHEN 'no_show'  THEN v_new_status := 'no_show';
    ELSE RETURN jsonb_build_object('success', false, 'reason', 'invalid_action');
  END CASE;

  UPDATE public.bookings
  SET
    status = v_new_status,
    updated_at = now(),
    audit_log = audit_log || jsonb_build_array(
      jsonb_build_object(
        'action', p_action,
        'by', p_staff_name,
        'at', now()::text,
        'note', p_note
      )
    )
  WHERE id = p_booking_id AND bot_id = p_bot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 8. update_booking_fields RPC
--    Allows staff to edit date/time/facility/location with audit trail.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_booking_fields(
  p_booking_id    uuid,
  p_bot_id        uuid,
  p_staff_name    text,
  p_note          text DEFAULT '',
  p_session_start timestamptz DEFAULT NULL,
  p_session_end   timestamptz DEFAULT NULL,
  p_facility_type text DEFAULT NULL,
  p_location      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.bookings
  SET
    session_start   = COALESCE(p_session_start, session_start),
    session_end     = COALESCE(p_session_end, session_end),
    facility_type   = COALESCE(p_facility_type, facility_type),
    location        = COALESCE(p_location, location),
    updated_at      = now(),
    audit_log       = audit_log || jsonb_build_array(
      jsonb_build_object(
        'action', 'edited',
        'by', p_staff_name,
        'at', now()::text,
        'note', p_note
      )
    )
  WHERE id = p_booking_id AND bot_id = p_bot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 9. find_next_available_slots RPC
--    Returns next N available (slot_start, slot_end) pairs
--    scanning forward from p_after, skipping full slots and
--    slots outside business hours (09:00–18:00 local time).
-- ============================================================

CREATE OR REPLACE FUNCTION public.find_next_available_slots(
  p_bot_id        uuid,
  p_facility_type text,
  p_location      text,
  p_after         timestamptz,
  p_limit         integer DEFAULT 3
)
RETURNS TABLE (slot_start timestamptz, slot_end timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  v_config      record;
  v_candidate   timestamptz;
  v_end         timestamptz;
  v_count       integer := 0;
  v_slot_count  integer;
  v_hour        integer;
BEGIN
  SELECT * INTO v_config
  FROM public.facilities_config
  WHERE bot_id = p_bot_id AND facility_type = p_facility_type;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Start scanning from next full hour after p_after
  v_candidate := date_trunc('hour', p_after) + interval '1 hour';

  WHILE v_count < p_limit LOOP
    -- Safety: stop after scanning max_window_days
    EXIT WHEN v_candidate > p_after + (v_config.max_window_days || ' days')::interval;

    -- Skip slots outside business hours 09:00–18:00 local (UTC+8 = Malaysia time)
    v_hour := EXTRACT(HOUR FROM v_candidate AT TIME ZONE 'Asia/Kuala_Lumpur');
    IF v_hour < 9 OR v_hour >= 18 THEN
      v_candidate := v_candidate + interval '1 hour';
      CONTINUE;
    END IF;

    v_end := v_candidate + (v_config.duration_minutes || ' minutes')::interval;

    -- Check capacity for this slot
    SELECT COUNT(*) INTO v_slot_count
    FROM public.bookings
    WHERE bot_id = p_bot_id
      AND facility_type = p_facility_type
      AND location = p_location
      AND session_start = v_candidate
      AND status IN ('pending', 'confirmed', 'walk_in');

    IF v_slot_count < v_config.capacity THEN
      slot_start := v_candidate;
      slot_end   := v_end;
      RETURN NEXT;
      v_count := v_count + 1;
    END IF;

    v_candidate := v_candidate + (v_config.duration_minutes || ' minutes')::interval;
  END LOOP;
END;
$$;
