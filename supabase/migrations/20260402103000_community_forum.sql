ALTER TABLE public.forum_posts
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
CHECK (category IN ('general', 'infrastructure', 'cleanliness', 'security', 'suggestions', 'appreciation'));

CREATE TABLE IF NOT EXISTS public.forum_post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'upvote' CHECK (reaction_type IN ('upvote')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT forum_post_reactions_post_user_reaction_key UNIQUE (post_id, user_id, reaction_type)
);

ALTER TABLE public.forum_post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view forum reactions" ON public.forum_post_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.forum_posts fp
      WHERE fp.id = post_id
        AND public.is_trip_member(auth.uid(), fp.trip_id)
    )
  );

CREATE POLICY "Trip members can add forum reactions" ON public.forum_post_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.forum_posts fp
      WHERE fp.id = post_id
        AND public.is_trip_member(auth.uid(), fp.trip_id)
    )
  );

CREATE POLICY "Users can remove their forum reactions" ON public.forum_post_reactions
  FOR DELETE USING (auth.uid() = user_id);
