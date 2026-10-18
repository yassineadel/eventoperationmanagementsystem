-- Moving an order's holds to "sold" or back to "free" (FR-CHK-07, FR-CHK-09, BR-10).
-- Same rule as the hold functions: one call, atomic, counters only change through conditional updates.

-- Payment succeeded: every hold of the order becomes sold. A hold that is still ACTIVE moves its
-- places from held to sold. A hold that expired while the buyer was paying is re-reserved if there
-- is still room; if not, HF_SOLD_OUT is raised and the caller refunds the payment.
CREATE OR REPLACE FUNCTION hf_convert_order_holds(p_order uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT id, ticket_category_id, quantity, status FROM holds
    WHERE order_id = p_order AND status <> 'CONVERTED'
    ORDER BY ticket_category_id, id
    FOR UPDATE
  LOOP
    IF rec.status = 'ACTIVE' THEN
      UPDATE ticket_categories
      SET held_count = held_count - rec.quantity, sold_count = sold_count + rec.quantity
      WHERE id = rec.ticket_category_id;
    ELSE
      UPDATE ticket_categories
      SET sold_count = sold_count + rec.quantity
      WHERE id = rec.ticket_category_id AND held_count + sold_count + rec.quantity <= capacity;
      IF NOT FOUND THEN RAISE EXCEPTION 'HF_SOLD_OUT'; END IF;
    END IF;
    UPDATE holds SET status = 'CONVERTED' WHERE id = rec.id;
  END LOOP;
END $$;

-- Payment failed or the order was abandoned: give the order's still-active holds back.
CREATE OR REPLACE FUNCTION hf_release_order_holds(p_order uuid)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  n int;
BEGIN
  WITH h AS (
    UPDATE holds SET status = 'RELEASED'
    WHERE order_id = p_order AND status = 'ACTIVE'
    RETURNING ticket_category_id, quantity
  ), per_category AS (
    SELECT ticket_category_id, SUM(quantity)::int AS q FROM h GROUP BY ticket_category_id
  ), c AS (
    UPDATE ticket_categories tc SET held_count = tc.held_count - p.q
    FROM per_category p WHERE tc.id = p.ticket_category_id
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO n FROM h;
  RETURN n;
END $$;
