-- FunTrip demo seed
-- Run this in Supabase SQL Editor after the migrations.
-- It creates one clearly marked demo trip and related records.

DO $$
DECLARE
  primary_user_id UUID;
  secondary_user_id UUID;
  demo_trip_id UUID := gen_random_uuid();
  lunch_expense_id UUID := gen_random_uuid();
  snacks_expense_id UUID := gen_random_uuid();
  settlement_payment_id UUID := gen_random_uuid();
  image_id UUID := gen_random_uuid();
  poll_id UUID := gen_random_uuid();
  poll_option_1_id UUID := gen_random_uuid();
  poll_option_2_id UUID := gen_random_uuid();
  poll_option_3_id UUID := gen_random_uuid();
  forum_post_1_id UUID := gen_random_uuid();
  forum_post_2_id UUID := gen_random_uuid();
  forum_reaction_1_id UUID := gen_random_uuid();
  forum_reaction_2_id UUID := gen_random_uuid();
  headcount INTEGER;
  snacks_headcount INTEGER;
  share_amount NUMERIC(10,2);
BEGIN
  SELECT user_id
  INTO primary_user_id
  FROM public.profiles
  WHERE role = 'super_admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF primary_user_id IS NULL THEN
    SELECT user_id
    INTO primary_user_id
    FROM public.profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF primary_user_id IS NULL THEN
    RAISE EXCEPTION 'No profile found. Create and log into an account first.';
  END IF;

  SELECT user_id
  INTO secondary_user_id
  FROM public.profiles
  WHERE user_id <> primary_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  DELETE FROM public.trips
  WHERE name = '[DEMO] Lonavala Weekend Escape';

  INSERT INTO public.trips (id, name, description, created_by)
  VALUES (
    demo_trip_id,
    '[DEMO] Lonavala Weekend Escape',
    'Demo trip for testing the full FunTrip flow. demo_seed_tag: funtrip_demo',
    primary_user_id
  );

  INSERT INTO public.trip_members (trip_id, user_id)
  SELECT demo_trip_id, user_id
  FROM public.profiles
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*)
  INTO headcount
  FROM public.trip_members
  WHERE trip_id = demo_trip_id;

  snacks_headcount := CASE WHEN secondary_user_id IS NULL THEN 1 ELSE 2 END;
  share_amount := ROUND((1800.00 / headcount)::numeric, 2);

  INSERT INTO public.expenses (id, trip_id, paid_by, description, amount)
  VALUES
    (lunch_expense_id, demo_trip_id, primary_user_id, 'Lunch stop on the expressway', 1800.00),
    (snacks_expense_id, demo_trip_id, COALESCE(secondary_user_id, primary_user_id), 'Road trip snacks and water', 600.00);

  INSERT INTO public.expense_shares (expense_id, user_id, amount)
  SELECT lunch_expense_id, user_id, share_amount
  FROM public.trip_members
  WHERE trip_id = demo_trip_id;

  INSERT INTO public.expense_shares (expense_id, user_id, amount)
  SELECT snacks_expense_id, user_id, ROUND((600.00 / snacks_headcount)::numeric, 2)
  FROM public.trip_members
  WHERE trip_id = demo_trip_id
    AND (
      user_id = primary_user_id
      OR user_id = COALESCE(secondary_user_id, primary_user_id)
    );

  IF secondary_user_id IS NOT NULL THEN
    INSERT INTO public.settlement_payments (
      id,
      trip_id,
      from_user_id,
      to_user_id,
      amount,
      notes,
      recorded_by
    )
    VALUES (
      settlement_payment_id,
      demo_trip_id,
      secondary_user_id,
      primary_user_id,
      250.00,
      'Partial UPI payment already recorded for shared snacks.',
      secondary_user_id
    );
  END IF;

  INSERT INTO public.trip_items (trip_id, brought_by, item_name, quantity, category, status)
  VALUES
    (demo_trip_id, primary_user_id, 'First aid kit', 1, 'medicine', 'bought'),
    (demo_trip_id, primary_user_id, 'Portable speaker', 1, 'electronics', 'buying'),
    (demo_trip_id, COALESCE(secondary_user_id, primary_user_id), 'Water bottles', 6, 'food', 'new'),
    (demo_trip_id, primary_user_id, 'Old mosquito spray', 1, 'toiletries', 'expired'),
    (demo_trip_id, primary_user_id, 'Rain jackets', 2, 'clothing', 'not_needed');

  INSERT INTO public.forum_posts (id, trip_id, created_by, title, body, category)
  VALUES
    (
      forum_post_1_id,
      demo_trip_id,
      primary_user_id,
      'Need a final packing check',
      'Please confirm by tonight if we still need extra blankets and paper plates.',
      'general'
    ),
    (
      forum_post_2_id,
      demo_trip_id,
      COALESCE(secondary_user_id, primary_user_id),
      'Breakfast plan for day one',
      'Let us decide whether to stop on the way or carry sandwiches from home.',
      'suggestions'
    );

  INSERT INTO public.forum_comments (post_id, user_id, comment)
  VALUES
    (forum_post_1_id, primary_user_id, 'I already packed the first aid kit and chargers.'),
    (forum_post_1_id, COALESCE(secondary_user_id, primary_user_id), 'I can bring paper plates if needed.'),
    (forum_post_2_id, primary_user_id, 'Let us carry sandwiches so we can start earlier.');

  INSERT INTO public.forum_post_reactions (id, post_id, user_id, reaction_type)
  VALUES
    (forum_reaction_1_id, forum_post_1_id, primary_user_id, 'upvote'),
    (forum_reaction_2_id, forum_post_2_id, COALESCE(secondary_user_id, primary_user_id), 'upvote')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.polls (id, trip_id, created_by, question, is_anonymous)
  VALUES (
    poll_id,
    demo_trip_id,
    primary_user_id,
    'Which plan should we lock for Saturday evening?',
    false
  );

  INSERT INTO public.poll_options (id, poll_id, option_text)
  VALUES
    (poll_option_1_id, poll_id, 'Lake view cafe'),
    (poll_option_2_id, poll_id, 'Street food market'),
    (poll_option_3_id, poll_id, 'Stay in and order dinner');

  INSERT INTO public.poll_votes (poll_id, option_id, user_id)
  VALUES
    (poll_id, poll_option_1_id, primary_user_id);

  IF secondary_user_id IS NOT NULL THEN
    INSERT INTO public.poll_votes (poll_id, option_id, user_id)
    VALUES (poll_id, poll_option_2_id, secondary_user_id);
  END IF;

  INSERT INTO public.trip_images (id, trip_id, uploaded_by, image_url, caption)
  VALUES (
    image_id,
    demo_trip_id,
    primary_user_id,
    '/placeholder.svg',
    'Demo gallery image'
  );

  INSERT INTO public.image_comments (image_id, user_id, comment)
  VALUES
    (image_id, primary_user_id, 'This is a placeholder image for demo mode.'),
    (image_id, COALESCE(secondary_user_id, primary_user_id), 'Looks good for testing comments.');
END $$;
