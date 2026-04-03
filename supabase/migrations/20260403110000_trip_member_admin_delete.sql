DROP POLICY IF EXISTS "Users can remove themselves" ON public.trip_members;
DROP POLICY IF EXISTS "Admins can remove trip members" ON public.trip_members;

CREATE POLICY "Admins can remove trip members" ON public.trip_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = trip_members.trip_id
        AND t.created_by <> trip_members.user_id
        AND (
          auth.uid() = trip_members.user_id
          OR t.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.user_id = auth.uid()
              AND p.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
          )
        )
    )
  );
