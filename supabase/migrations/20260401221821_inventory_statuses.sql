ALTER TABLE public.trip_items
ADD COLUMN status TEXT;

UPDATE public.trip_items
SET status = CASE
  WHEN is_packed THEN 'bought'
  ELSE 'new'
END
WHERE status IS NULL;

ALTER TABLE public.trip_items
ALTER COLUMN status SET DEFAULT 'new',
ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.trip_items
ADD CONSTRAINT trip_items_status_check
CHECK (status IN ('new', 'buying', 'bought', 'expired', 'not_needed'));

ALTER TABLE public.trip_items
DROP COLUMN is_packed;
