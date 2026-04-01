CREATE TABLE public.forum_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'buying', 'bought', 'expired', 'not_needed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view forum posts" ON public.forum_posts
  FOR SELECT USING (public.is_trip_member(auth.uid(), trip_id));
CREATE POLICY "Trip members can create forum posts" ON public.forum_posts
  FOR INSERT WITH CHECK (public.is_trip_member(auth.uid(), trip_id) AND auth.uid() = created_by);
CREATE POLICY "Forum post owner can update" ON public.forum_posts
  FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Forum post owner can delete" ON public.forum_posts
  FOR DELETE USING (auth.uid() = created_by);

CREATE TABLE public.forum_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view forum comments" ON public.forum_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.forum_posts fp
      WHERE fp.id = post_id AND public.is_trip_member(auth.uid(), fp.trip_id)
    )
  );
CREATE POLICY "Trip members can add forum comments" ON public.forum_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forum_posts fp
      WHERE fp.id = post_id AND public.is_trip_member(auth.uid(), fp.trip_id)
    ) AND auth.uid() = user_id
  );
CREATE POLICY "Forum comment author can delete" ON public.forum_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_forum_posts_updated_at
BEFORE UPDATE ON public.forum_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
