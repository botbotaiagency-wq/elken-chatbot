-- ============================================================
-- Migration 00012: Add user_id and channel to check_and_create_booking RPC
-- These params are populated from the chatbot conversation so that
-- dispatchNotification can route confirmation/reminder/survey back to the
-- correct WhatsApp/Telegram user.
-- New params are DEFAULT NULL for backward compatibility with walk-in bookings.
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
  p_gender        text,        -- 'male' | 'female' | null
  p_status        text,        -- 'pending' | 'walk_in'
  p_user_id       text DEFAULT NULL,
  p_channel       text DEFAULT NULL
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
    customer_gender, status, user_id, channel, audit_log
  ) VALUES (
    p_bot_id, p_facility_type, p_location, p_session_start, p_session_end,
    p_customer_name, p_member_id, p_contact, p_is_member, p_has_bes,
    p_gender, p_status, p_user_id, p_channel,
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
