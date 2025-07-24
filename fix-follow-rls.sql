-- Fix RLS policies for follow_relationships to ensure proper access
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view relevant follow relationships" ON public.follow_relationships;
DROP POLICY IF EXISTS "Athletes can create follow requests" ON public.follow_relationships;
DROP POLICY IF EXISTS "Users can update their follow relationships" ON public.follow_relationships;

-- Create more specific and permissive policies for follow_relationships

-- Allow athletes to see follow requests they sent
CREATE POLICY "Athletes can view their own follow requests" ON public.follow_relationships
  FOR SELECT TO authenticated 
  USING (auth.uid() = athlete_id);

-- Allow clinicians to see follow requests sent to them (both pending and accepted)
CREATE POLICY "Clinicians can view their follow relationships" ON public.follow_relationships
  FOR SELECT TO authenticated 
  USING (auth.uid() = clinician_id);

-- Allow athletes to create follow requests
CREATE POLICY "Athletes can create follow requests" ON public.follow_relationships
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = athlete_id);

-- Allow athletes to update/cancel their own requests
CREATE POLICY "Athletes can update their follow requests" ON public.follow_relationships
  FOR UPDATE TO authenticated 
  USING (auth.uid() = athlete_id);

-- Allow clinicians to update follow requests sent to them (accept/reject)
CREATE POLICY "Clinicians can respond to follow requests" ON public.follow_relationships
  FOR UPDATE TO authenticated 
  USING (auth.uid() = clinician_id);

-- Allow deletion by either party
CREATE POLICY "Users can delete their follow relationships" ON public.follow_relationships
  FOR DELETE TO authenticated 
  USING (auth.uid() = athlete_id OR auth.uid() = clinician_id);

-- Also ensure athlete_profiles and clinician_profiles are accessible for joins
-- Update athlete_profiles policy to allow clinicians to view athlete info in follow relationships
DROP POLICY IF EXISTS "Athletes can manage their own profile" ON public.athlete_profiles;

CREATE POLICY "Athletes can manage their own profile" ON public.athlete_profiles
  FOR ALL TO authenticated 
  USING (auth.uid() = athlete_id);

CREATE POLICY "Clinicians can view connected athlete profiles" ON public.athlete_profiles
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.follow_relationships 
      WHERE follow_relationships.athlete_id = athlete_profiles.athlete_id 
      AND follow_relationships.clinician_id = auth.uid()
      AND follow_relationships.status IN ('pending', 'accepted')
    )
  );

-- Ensure users table allows proper access for profile information in joins
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Athletes can view clinician profiles" ON public.users;

CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Connected users can view each other" ON public.users
  FOR SELECT TO authenticated 
  USING (
    auth.uid() = user_id OR
    role = 'clinician' OR
    EXISTS (
      SELECT 1 FROM public.follow_relationships fr
      WHERE (fr.athlete_id = auth.uid() AND fr.clinician_id = users.user_id AND fr.status IN ('pending', 'accepted'))
      OR (fr.clinician_id = auth.uid() AND fr.athlete_id = users.user_id AND fr.status IN ('pending', 'accepted'))
    )
  );

-- Test query to verify the policies work
-- This should return follow relationships for the authenticated clinician
-- SELECT fr.*, ap.*, u.first_name, u.last_name 
-- FROM follow_relationships fr
-- JOIN athlete_profiles ap ON fr.athlete_id = ap.athlete_id
-- JOIN users u ON ap.athlete_id = u.user_id
-- WHERE fr.clinician_id = auth.uid() AND fr.status = 'pending'; 