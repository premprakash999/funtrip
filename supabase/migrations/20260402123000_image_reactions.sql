CREATE TABLE IF NOT EXISTS public.image_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID REFERENCES public.trip_images(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like' CHECK (reaction_type IN ('like')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT image_reactions_image_user_reaction_key UNIQUE (image_id, user_id, reaction_type)
);

ALTER TABLE public.image_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view image reactions" ON public.image_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.trip_images ti
      WHERE ti.id = image_id
        AND public.is_trip_member(auth.uid(), ti.trip_id)
    )
  );

CREATE POLICY "Trip members can add image reactions" ON public.image_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.trip_images ti
      WHERE ti.id = image_id
        AND public.is_trip_member(auth.uid(), ti.trip_id)
    )
  );

CREATE POLICY "Users can remove their image reactions" ON public.image_reactions
  FOR DELETE USING (auth.uid() = user_id);
