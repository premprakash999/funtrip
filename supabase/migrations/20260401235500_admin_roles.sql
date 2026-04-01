DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin');
  END IF;
END $$;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'admin';

UPDATE public.profiles
SET role = 'admin'
WHERE role IS NULL;

WITH first_profile AS (
  SELECT id
  FROM public.profiles
  ORDER BY created_at ASC, id ASC
  LIMIT 1
)
UPDATE public.profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM first_profile)
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE role = 'super_admin'
  );

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE role = 'super_admin'
      ) THEN 'admin'::public.app_role
      ELSE 'super_admin'::public.app_role
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Authenticated users can create trips" ON public.trips;

CREATE POLICY "Super admins can create trips" ON public.trips
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_super_admin(auth.uid())
  );
