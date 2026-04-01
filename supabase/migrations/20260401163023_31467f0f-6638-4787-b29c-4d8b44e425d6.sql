
-- Polls table
CREATE TABLE public.polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view polls" ON public.polls
  FOR SELECT USING (public.is_trip_member(auth.uid(), trip_id));
CREATE POLICY "Trip members can create polls" ON public.polls
  FOR INSERT WITH CHECK (public.is_trip_member(auth.uid(), trip_id) AND auth.uid() = created_by);
CREATE POLICY "Poll creator can delete" ON public.polls
  FOR DELETE USING (auth.uid() = created_by);

-- Poll options
CREATE TABLE public.poll_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view options" ON public.poll_options
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND public.is_trip_member(auth.uid(), p.trip_id))
  );
CREATE POLICY "Poll creator can add options" ON public.poll_options
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND auth.uid() = p.created_by)
  );

-- Poll votes
CREATE TABLE public.poll_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view votes" ON public.poll_votes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND public.is_trip_member(auth.uid(), p.trip_id))
  );
CREATE POLICY "Trip members can vote" ON public.poll_votes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND public.is_trip_member(auth.uid(), p.trip_id))
  );
