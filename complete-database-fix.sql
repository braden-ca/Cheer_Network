-- Complete Database Fix for Cheer Network
-- This script creates missing tables and fixes RLS policies

-- =============================================================================
-- CREATE MISSING LOOKUP TABLES
-- =============================================================================

-- Create specialties lookup table
CREATE TABLE IF NOT EXISTS public.specialties_lookup (
  specialty_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create schools lookup table  
CREATE TABLE IF NOT EXISTS public.schools_lookup (
  school_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  city TEXT,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on lookup tables
ALTER TABLE public.specialties_lookup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools_lookup ENABLE ROW LEVEL SECURITY;

-- Create indexes for lookup tables
CREATE INDEX IF NOT EXISTS idx_specialties_lookup_name ON public.specialties_lookup(name);
CREATE INDEX IF NOT EXISTS idx_schools_lookup_name ON public.schools_lookup(name);
CREATE INDEX IF NOT EXISTS idx_schools_lookup_location ON public.schools_lookup(city, state);

-- =============================================================================
-- INSERT INITIAL DATA
-- =============================================================================

-- Insert initial specialties
INSERT INTO public.specialties_lookup (name) VALUES 
  ('Tumbling'),
  ('Stunting'),
  ('Jumps'),
  ('Dance/Choreography'),
  ('Conditioning'),
  ('Flexibility'),
  ('Competition Prep'),
  ('Team Building'),
  ('Mental Performance'),
  ('Injury Prevention'),
  ('Nutrition'),
  ('Leadership Development')
ON CONFLICT (name) DO NOTHING;

-- Insert some sample schools
INSERT INTO public.schools_lookup (name, city, state) VALUES 
  ('University of California, Los Angeles', 'Los Angeles', 'CA'),
  ('University of Kentucky', 'Lexington', 'KY'),
  ('University of Alabama', 'Tuscaloosa', 'AL'),
  ('University of Georgia', 'Athens', 'GA'),
  ('Louisiana State University', 'Baton Rouge', 'LA'),
  ('University of Florida', 'Gainesville', 'FL'),
  ('Texas Tech University', 'Lubbock', 'TX'),
  ('University of Central Florida', 'Orlando', 'FL')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- FIX ESSENTIAL RLS POLICIES
-- =============================================================================

-- Fix users table policy to allow athletes to view clinician info
DROP POLICY IF EXISTS "Anyone can view clinician user info" ON public.users;

CREATE POLICY "Athletes can view clinician profiles" ON public.users
  FOR SELECT TO authenticated USING (
    -- Users can always view their own profile
    auth.uid() = user_id OR
    -- Athletes can view clinician user info for coach discovery
    role = 'clinician'
  );

-- Ensure clinician profiles are publicly viewable to authenticated users
DROP POLICY IF EXISTS "Anyone can view clinician profiles" ON public.clinician_profiles;

CREATE POLICY "Public can view clinician profiles" ON public.clinician_profiles
  FOR SELECT TO authenticated USING (true);

-- Ensure lookup tables are accessible
DROP POLICY IF EXISTS "Anyone can view specialties" ON public.specialties_lookup;
CREATE POLICY "All authenticated users can view specialties" ON public.specialties_lookup
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can add specialties" ON public.specialties_lookup
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view schools" ON public.schools_lookup;
CREATE POLICY "All authenticated users can view schools" ON public.schools_lookup
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can add schools" ON public.schools_lookup
  FOR INSERT TO authenticated WITH CHECK (true);

-- Fix follow relationships for proper connection requests
DROP POLICY IF EXISTS "Users can view relevant follow relationships" ON public.follow_relationships;
CREATE POLICY "Users can view their follow relationships" ON public.follow_relationships
  FOR SELECT USING (auth.uid() = athlete_id OR auth.uid() = clinician_id);

DROP POLICY IF EXISTS "Athletes can create follow requests" ON public.follow_relationships;
CREATE POLICY "Athletes can create follow requests" ON public.follow_relationships
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "Users can update their follow relationships" ON public.follow_relationships;
CREATE POLICY "Users can update their follow relationships" ON public.follow_relationships
  FOR UPDATE USING (auth.uid() = athlete_id OR auth.uid() = clinician_id);

-- =============================================================================
-- VERIFY SETUP
-- =============================================================================

-- Create a verification function
CREATE OR REPLACE FUNCTION verify_database_setup()
RETURNS TABLE(
  table_name text,
  table_exists boolean,
  row_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'users'::text,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public'),
    (SELECT COUNT(*) FROM public.users);
    
  RETURN QUERY
  SELECT 
    'clinician_profiles'::text,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'clinician_profiles' AND table_schema = 'public'),
    (SELECT COUNT(*) FROM public.clinician_profiles);
    
  RETURN QUERY
  SELECT 
    'specialties_lookup'::text,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'specialties_lookup' AND table_schema = 'public'),
    (SELECT COUNT(*) FROM public.specialties_lookup);
    
  RETURN QUERY
  SELECT 
    'schools_lookup'::text,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'schools_lookup' AND table_schema = 'public'),
    (SELECT COUNT(*) FROM public.schools_lookup);
END;
$$; 