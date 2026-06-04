-- RPC: confirm_interview_slot
-- Called by the student to confirm which offered slot they want.
-- SECURITY DEFINER so the student can write to applications without a
-- direct UPDATE policy on that table.
--
-- Run this in the Supabase SQL Editor.

DROP FUNCTION IF EXISTS confirm_interview_slot(uuid);

CREATE FUNCTION confirm_interview_slot(p_slot_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_id    bigint;
  v_slot_time timestamptz;
BEGIN
  -- Verify the slot exists and belongs to the calling student's application
  SELECT is2.application_id, is2.slot_time
  INTO v_app_id, v_slot_time
  FROM interview_slots is2
  JOIN applications a ON a.id = is2.application_id
  WHERE is2.id = p_slot_id AND a.student_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found or not authorized';
  END IF;

  -- Clear all prior selections for this application
  UPDATE interview_slots SET selected = false WHERE application_id = v_app_id;

  -- Mark the chosen slot
  UPDATE interview_slots SET selected = true WHERE id = p_slot_id;

  -- Write the confirmed time back to the application so the company dashboard
  -- can read it without querying interview_slots separately
  UPDATE applications
  SET interview_date = (v_slot_time AT TIME ZONE 'UTC')::date,
      interview_time = to_char(v_slot_time AT TIME ZONE 'UTC', 'HH24:MI')
  WHERE id = v_app_id;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_interview_slot(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
