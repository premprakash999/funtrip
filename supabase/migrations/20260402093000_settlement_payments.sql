CREATE TABLE public.settlement_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.settlement_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view settlement payments" ON public.settlement_payments
  FOR SELECT USING (public.is_trip_member(auth.uid(), trip_id));

CREATE POLICY "Payer can record settlement payments" ON public.settlement_payments
  FOR INSERT WITH CHECK (
    public.is_trip_member(auth.uid(), trip_id)
    AND auth.uid() = from_user_id
    AND auth.uid() = recorded_by
  );
