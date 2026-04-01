
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trips table
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Trip members
CREATE TABLE public.trip_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check trip membership
CREATE OR REPLACE FUNCTION public.is_trip_member(_user_id UUID, _trip_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE user_id = _user_id AND trip_id = _trip_id
  )
$$;

-- Trip policies
CREATE POLICY "Trip members can view trips" ON public.trips
  FOR SELECT USING (public.is_trip_member(auth.uid(), id));
CREATE POLICY "Authenticated users can create trips" ON public.trips
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Trip creator can update" ON public.trips
  FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Trip creator can delete" ON public.trips
  FOR DELETE USING (auth.uid() = created_by);

-- Trip members policies
CREATE POLICY "Trip members can view members" ON public.trip_members
  FOR SELECT USING (public.is_trip_member(auth.uid(), trip_id));
CREATE POLICY "Trip members can add members" ON public.trip_members
  FOR INSERT WITH CHECK (public.is_trip_member(auth.uid(), trip_id) OR auth.uid() = user_id);
CREATE POLICY "Users can remove themselves" ON public.trip_members
  FOR DELETE USING (auth.uid() = user_id);

-- Expenses
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  paid_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view expenses" ON public.expenses
  FOR SELECT USING (public.is_trip_member(auth.uid(), trip_id));
CREATE POLICY "Trip members can add expenses" ON public.expenses
  FOR INSERT WITH CHECK (public.is_trip_member(auth.uid(), trip_id) AND auth.uid() = paid_by);
CREATE POLICY "Expense creator can delete" ON public.expenses
  FOR DELETE USING (auth.uid() = paid_by);

-- Expense shares
CREATE TABLE public.expense_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  UNIQUE(expense_id, user_id)
);

ALTER TABLE public.expense_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view shares" ON public.expense_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND public.is_trip_member(auth.uid(), e.trip_id)
    )
  );
CREATE POLICY "Trip members can add shares" ON public.expense_shares
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND public.is_trip_member(auth.uid(), e.trip_id)
    )
  );
CREATE POLICY "Share creator can delete" ON public.expense_shares
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND auth.uid() = e.paid_by
    )
  );

-- Trip images
CREATE TABLE public.trip_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view images" ON public.trip_images
  FOR SELECT USING (public.is_trip_member(auth.uid(), trip_id));
CREATE POLICY "Trip members can upload images" ON public.trip_images
  FOR INSERT WITH CHECK (public.is_trip_member(auth.uid(), trip_id) AND auth.uid() = uploaded_by);
CREATE POLICY "Image uploader can delete" ON public.trip_images
  FOR DELETE USING (auth.uid() = uploaded_by);

-- Image comments
CREATE TABLE public.image_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID REFERENCES public.trip_images(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.image_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view comments" ON public.image_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trip_images ti
      WHERE ti.id = image_id AND public.is_trip_member(auth.uid(), ti.trip_id)
    )
  );
CREATE POLICY "Trip members can add comments" ON public.image_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_images ti
      WHERE ti.id = image_id AND public.is_trip_member(auth.uid(), ti.trip_id)
    ) AND auth.uid() = user_id
  );
CREATE POLICY "Comment author can delete" ON public.image_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for trip images
INSERT INTO storage.buckets (id, name, public) VALUES ('trip-images', 'trip-images', true);

CREATE POLICY "Anyone can view trip images" ON storage.objects
  FOR SELECT USING (bucket_id = 'trip-images');
CREATE POLICY "Authenticated users can upload trip images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'trip-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete their own uploads" ON storage.objects
  FOR DELETE USING (bucket_id = 'trip-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
