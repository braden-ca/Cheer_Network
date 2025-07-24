-- Fix Database Schema Issues
-- This script addresses the missing tables and fields found by the debug suite

-- Create lookup tables if they don't exist
CREATE TABLE IF NOT EXISTS public.specialties_lookup (
  specialty_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.schools_lookup (
  school_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  city TEXT,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing fields to clinician_profiles if they don't exist
-- Note: ALTER TABLE ADD COLUMN IF NOT EXISTS is PostgreSQL 9.6+
DO $$ 
BEGIN 
  -- Add city column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'clinician_profiles' AND column_name = 'city') THEN
    ALTER TABLE public.clinician_profiles ADD COLUMN city TEXT;
  END IF;
  
  -- Add state column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'clinician_profiles' AND column_name = 'state') THEN
    ALTER TABLE public.clinician_profiles ADD COLUMN state TEXT;
  END IF;
  
  -- Add current_school column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'clinician_profiles' AND column_name = 'current_school') THEN
    ALTER TABLE public.clinician_profiles ADD COLUMN current_school TEXT;
  END IF;
END $$;

-- Insert some sample specialties
INSERT INTO public.specialties_lookup (name) VALUES 
  ('Tumbling'),
  ('Stunting'),
  ('Choreography'),
  ('Flexibility Training'),
  ('Strength & Conditioning'),
  ('Competition Prep'),
  ('Team Building'),
  ('Performance Coaching')
ON CONFLICT (name) DO NOTHING;

-- Insert some sample schools
INSERT INTO public.schools_lookup (name, city, state) VALUES 
  ('University of Alabama', 'Tuscaloosa', 'AL'),
  ('University of Kentucky', 'Lexington', 'KY'),
  ('University of Oklahoma', 'Norman', 'OK'),
  ('University of Tennessee', 'Knoxville', 'TN'),
  ('University of Florida', 'Gainesville', 'FL'),
  ('Louisiana State University', 'Baton Rouge', 'LA'),
  ('University of Georgia', 'Athens', 'GA'),
  ('Auburn University', 'Auburn', 'AL'),
  ('University of Arkansas', 'Fayetteville', 'AR'),
  ('University of Mississippi', 'Oxford', 'MS')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS on lookup tables
ALTER TABLE public.specialties_lookup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools_lookup ENABLE ROW LEVEL SECURITY;

-- Create policies for lookup tables (allow all authenticated users to read)
DROP POLICY IF EXISTS "Allow authenticated users to read specialties" ON public.specialties_lookup;
CREATE POLICY "Allow authenticated users to read specialties" ON public.specialties_lookup
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to read schools" ON public.schools_lookup;
CREATE POLICY "Allow authenticated users to read schools" ON public.schools_lookup
  FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_specialties_lookup_name ON public.specialties_lookup(name);
CREATE INDEX IF NOT EXISTS idx_schools_lookup_name ON public.schools_lookup(name);
CREATE INDEX IF NOT EXISTS idx_schools_lookup_state ON public.schools_lookup(state);
CREATE INDEX IF NOT EXISTS idx_clinician_profiles_city_state ON public.clinician_profiles(city, state); 