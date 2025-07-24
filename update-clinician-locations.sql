-- Update existing clinicians with sample location data
-- Run this in Supabase Dashboard > SQL Editor

-- First, let's see the current clinicians
SELECT 
  cp.clinician_id,
  u.first_name,
  u.last_name,
  cp.city,
  cp.state
FROM clinician_profiles cp
JOIN users u ON cp.clinician_id = u.user_id
ORDER BY u.first_name;

-- Update clinicians without location data
-- We'll assign different cities to each clinician

UPDATE clinician_profiles 
SET 
  city = CASE 
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 0) THEN 'Dallas'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 1) THEN 'Los Angeles'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 2) THEN 'Atlanta'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 3) THEN 'Phoenix'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 4) THEN 'Denver'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 5) THEN 'Miami'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 6) THEN 'Chicago'
    ELSE 'Seattle'
  END,
  state = CASE 
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 0) THEN 'TX'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 1) THEN 'CA'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 2) THEN 'GA'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 3) THEN 'AZ'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 4) THEN 'CO'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 5) THEN 'FL'
    WHEN clinician_id = (SELECT clinician_id FROM clinician_profiles ORDER BY clinician_id LIMIT 1 OFFSET 6) THEN 'IL'
    ELSE 'WA'
  END
WHERE city IS NULL OR state IS NULL;

-- Verify the updates
SELECT 
  cp.clinician_id,
  u.first_name,
  u.last_name,
  cp.city,
  cp.state,
  CONCAT(cp.city, ', ', cp.state) as location
FROM clinician_profiles cp
JOIN users u ON cp.clinician_id = u.user_id
ORDER BY u.first_name; 