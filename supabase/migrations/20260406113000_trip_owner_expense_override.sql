DROP POLICY IF EXISTS "Expense creator can update" ON public.expenses;
DROP POLICY IF EXISTS "Expense creator can delete" ON public.expenses;
DROP POLICY IF EXISTS "Expense creator can delete shares" ON public.expense_shares;

CREATE POLICY "Expense creator or trip owner can update" ON public.expenses
  FOR UPDATE
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = expenses.trip_id
        AND t.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_trip_member(paid_by, trip_id)
    AND (
      auth.uid() = created_by
      OR EXISTS (
        SELECT 1
        FROM public.trips t
        WHERE t.id = expenses.trip_id
          AND t.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Expense creator or trip owner can delete" ON public.expenses
  FOR DELETE
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = expenses.trip_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY "Expense creator or trip owner can delete shares" ON public.expense_shares
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.expenses e
      JOIN public.trips t ON t.id = e.trip_id
      WHERE e.id = expense_id
        AND (
          auth.uid() = e.created_by
          OR t.created_by = auth.uid()
        )
    )
  );
