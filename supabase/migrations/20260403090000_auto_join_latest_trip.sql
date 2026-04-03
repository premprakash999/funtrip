DO $$
DECLARE
  latest_trip_id UUID;
BEGIN
  SELECT id
  INTO latest_trip_id
  FROM public.trips
  ORDER BY created_at DESC
  LIMIT 1;

  IF latest_trip_id IS NOT NULL THEN
    INSERT INTO public.trip_members (trip_id, user_id)
    SELECT latest_trip_id, profile.user_id
    FROM public.profiles AS profile
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role public.app_role;
  latest_trip_id UUID;
BEGIN
  assigned_role := CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE role = 'super_admin'
    ) THEN 'admin'::public.app_role
    ELSE 'super_admin'::public.app_role
  END;

  INSERT INTO public.profiles (user_id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    assigned_role
  );

  SELECT id
  INTO latest_trip_id
  FROM public.trips
  ORDER BY created_at DESC
  LIMIT 1;

  IF latest_trip_id IS NOT NULL THEN
    INSERT INTO public.trip_members (trip_id, user_id)
    VALUES (latest_trip_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
