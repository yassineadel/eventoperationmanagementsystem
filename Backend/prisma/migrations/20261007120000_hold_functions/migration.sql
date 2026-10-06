-- Inventory hold functions (FR-TKT-05, FR-TKT-10, FR-TKT-11, FR-TKT-14, BR-01, BR-10).
--
-- Each hold runs as ONE database call, so the row lock on a ticket category's counter is held for
-- the few milliseconds the function runs, not for several network round trips. That keeps the
-- category from becoming a single-file queue when hundreds of buyers arrive at once.
--
-- Errors are raised with a message starting "HF_" so the API can turn them into friendly messages.

CREATE OR REPLACE FUNCTION hf_assert_user_limit(p_user uuid, p_event uuid, p_adding int, p_max int)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  n int;
BEGIN
  -- One user's parallel requests queue here, so they cannot both pass the check (BR-01)
  PERFORM pg_advisory_xact_lock(hashtext(p_user::text || ':' || p_event::text));

  SELECT
    (SELECT COALESCE(SUM(quantity), 0) FROM holds
      WHERE user_id = p_user AND event_id = p_event AND status = 'ACTIVE' AND expires_at > now())
    +
    (SELECT COUNT(*) FROM tickets
      WHERE purchaser_id = p_user AND event_id = p_event AND status IN ('VALID', 'USED'))
  INTO n;

  IF n + p_adding > p_max THEN
    RAISE EXCEPTION 'HF_USER_LIMIT:%', GREATEST(p_max - n, 0);
  END IF;
END $$;

-- Standing venues: hold p_qty places in one category. Returns the new hold id.
CREATE OR REPLACE FUNCTION hf_hold_standing(
  p_user uuid, p_event uuid, p_category uuid, p_qty int, p_minutes int, p_max int
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_type "VenueType";
  v_hold uuid;
BEGIN
  SELECT v.type INTO v_type
  FROM ticket_categories tc
  JOIN events e ON e.id = tc.event_id
  JOIN venues v ON v.id = e.venue_id
  WHERE tc.id = p_category AND tc.event_id = p_event;

  IF NOT FOUND THEN RAISE EXCEPTION 'HF_CATEGORY_NOT_FOUND'; END IF;
  IF v_type <> 'STANDING' THEN RAISE EXCEPTION 'HF_NOT_STANDING'; END IF;

  PERFORM hf_assert_user_limit(p_user, p_event, p_qty, p_max);

  -- "Add p_qty, but only if there is room" — the database decides availability
  UPDATE ticket_categories
  SET held_count = held_count + p_qty
  WHERE id = p_category AND held_count + sold_count + p_qty <= capacity;
  IF NOT FOUND THEN RAISE EXCEPTION 'HF_SOLD_OUT'; END IF;

  INSERT INTO holds (id, user_id, event_id, ticket_category_id, quantity, expires_at)
  VALUES (gen_random_uuid(), p_user, p_event, p_category, p_qty, now() + make_interval(mins => p_minutes))
  RETURNING id INTO v_hold;

  RETURN v_hold;
END $$;

-- Seated venues: hold specific seats, all or nothing. Returns the new hold ids.
CREATE OR REPLACE FUNCTION hf_hold_seats(
  p_user uuid, p_event uuid, p_venue uuid, p_seats uuid[], p_minutes int, p_max int
) RETURNS SETOF uuid LANGUAGE plpgsql AS $$
DECLARE
  n_seats int := cardinality(p_seats);
  n_locked int;
  rec record;
BEGIN
  -- Lock the seat rows in a fixed order (no deadlocks) so a seat cannot be held and sold at once
  PERFORM 1 FROM seats WHERE id = ANY(p_seats) AND venue_id = p_venue ORDER BY id FOR UPDATE;
  GET DIAGNOSTICS n_locked = ROW_COUNT;
  IF n_locked <> n_seats THEN RAISE EXCEPTION 'HF_SEAT_NOT_IN_VENUE'; END IF;

  IF EXISTS (SELECT 1 FROM tickets
             WHERE event_id = p_event AND seat_id = ANY(p_seats) AND status IN ('VALID', 'USED')) THEN
    RAISE EXCEPTION 'HF_SEAT_SOLD';
  END IF;

  IF EXISTS (SELECT 1 FROM seats s
             LEFT JOIN ticket_categories tc ON tc.event_id = p_event AND tc.category_key = s.category_key
             WHERE s.id = ANY(p_seats) AND tc.id IS NULL) THEN
    RAISE EXCEPTION 'HF_SEAT_NOT_ON_SALE';
  END IF;

  PERFORM hf_assert_user_limit(p_user, p_event, n_seats, p_max);

  FOR rec IN
    SELECT tc.id AS category_id, COUNT(*)::int AS n
    FROM seats s JOIN ticket_categories tc ON tc.event_id = p_event AND tc.category_key = s.category_key
    WHERE s.id = ANY(p_seats)
    GROUP BY tc.id
    ORDER BY tc.id
  LOOP
    UPDATE ticket_categories
    SET held_count = held_count + rec.n
    WHERE id = rec.category_id AND held_count + sold_count + rec.n <= capacity;
    IF NOT FOUND THEN RAISE EXCEPTION 'HF_SOLD_OUT'; END IF;
  END LOOP;

  -- uidx_holds_seat_active rejects a seat someone else holds right now (unique_violation)
  RETURN QUERY
  INSERT INTO holds (id, user_id, event_id, ticket_category_id, seat_id, quantity, expires_at)
  SELECT gen_random_uuid(), p_user, p_event, tc.id, s.id, 1, now() + make_interval(mins => p_minutes)
  FROM seats s JOIN ticket_categories tc ON tc.event_id = p_event AND tc.category_key = s.category_key
  WHERE s.id = ANY(p_seats)
  RETURNING id;
END $$;
