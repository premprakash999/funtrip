DROP POLICY IF EXISTS "Trip members can add members" ON public.trip_members;
DROP POLICY IF EXISTS "Users can remove themselves" ON public.trip_members;
DROP POLICY IF EXISTS "Admins can remove trip members" ON public.trip_members;
DROP POLICY IF EXISTS "Trip owners can add members" ON public.trip_members;
DROP POLICY IF EXISTS "Trip owners can remove members" ON public.trip_members;

CREATE POLICY "Trip owners can add members" ON public.trip_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_members.trip_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY "Trip owners can remove members" ON public.trip_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_members.trip_id
        AND t.created_by = auth.uid()
        AND trip_members.user_id <> t.created_by
    )
  );
