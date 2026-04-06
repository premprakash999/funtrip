ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.expenses
SET created_by = paid_by
WHERE created_by IS NULL;

ALTER TABLE public.expenses
ALTER COLUMN created_by SET NOT NULL;

DROP POLICY IF EXISTS "Trip members can add expenses" ON public.expenses;
DROP POLICY IF EXISTS "Expense creator can update" ON public.expenses;
DROP POLICY IF EXISTS "Expense creator can delete" ON public.expenses;

CREATE POLICY "Trip members can add expenses" ON public.expenses
  FOR INSERT
  WITH CHECK (
    public.is_trip_member(auth.uid(), trip_id)
    AND public.is_trip_member(paid_by, trip_id)
    AND auth.uid() = created_by
  );

CREATE POLICY "Expense creator can update" ON public.expenses
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_trip_member(paid_by, trip_id)
  );

CREATE POLICY "Expense creator can delete" ON public.expenses
  FOR DELETE
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Share creator can delete" ON public.expense_shares;
DROP POLICY IF EXISTS "Expense creator can delete shares" ON public.expense_shares;

CREATE POLICY "Expense creator can delete shares" ON public.expense_shares
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.expenses e
      WHERE e.id = expense_id
        AND auth.uid() = e.created_by
    )
  );
