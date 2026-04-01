
CREATE TABLE public.trip_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  brought_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'general',
  is_packed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view items" ON public.trip_items
  FOR SELECT USING (public.is_trip_member(auth.uid(), trip_id));
CREATE POLICY "Trip members can add items" ON public.trip_items
  FOR INSERT WITH CHECK (public.is_trip_member(auth.uid(), trip_id) AND auth.uid() = brought_by);
CREATE POLICY "Item owner can update" ON public.trip_items
  FOR UPDATE USING (auth.uid() = brought_by);
CREATE POLICY "Item owner can delete" ON public.trip_items
  FOR DELETE USING (auth.uid() = brought_by);
