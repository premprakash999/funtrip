-- FunTrip demo cleanup
-- Run this in Supabase SQL Editor before real usage.
-- It deletes only the seeded demo trip and its related records via cascade.

DELETE FROM public.trips
WHERE name = '[DEMO] Lonavala Weekend Escape'
   OR description ILIKE '%demo_seed_tag: funtrip_demo%';
