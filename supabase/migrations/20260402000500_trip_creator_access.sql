DROP POLICY IF EXISTS "Trip creator can view own trips" ON public.trips;

CREATE POLICY "Trip creator can view own trips" ON public.trips
  FOR SELECT
  USING (auth.uid() = created_by);
