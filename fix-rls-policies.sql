-- Comprehensive RLS Policy Fixes for Cheer Network
-- This script updates all RLS policies to allow proper access while maintaining security

-- =============================================================================
-- USERS TABLE POLICIES
-- =============================================================================

-- Drop existing users policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Anyone can view clinician user info" ON public.users;
DROP POLICY IF EXISTS "Athletes can view clinician user info" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

-- Create comprehensive users policies
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Athletes can view clinician profiles" ON public.users
  FOR SELECT TO authenticated USING (
    -- Users can always view their own profile
    auth.uid() = user_id OR
    -- Athletes can view clinician user info for coach discovery
    role = 'clinician'
  );

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- CLINICIAN PROFILES POLICIES
-- =============================================================================

-- Drop existing clinician profiles policies
DROP POLICY IF EXISTS "Clinicians can manage their own profile" ON public.clinician_profiles;
DROP POLICY IF EXISTS "Anyone can view clinician profiles" ON public.clinician_profiles;
DROP POLICY IF EXISTS "Authenticated users can view clinician profiles" ON public.clinician_profiles;

-- Create comprehensive clinician profiles policies
CREATE POLICY "Clinicians can manage their own profile" ON public.clinician_profiles
  FOR ALL USING (auth.uid() = clinician_id);

CREATE POLICY "Public can view clinician profiles" ON public.clinician_profiles
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- ATHLETE PROFILES POLICIES  
-- =============================================================================

-- Drop existing athlete profiles policies
DROP POLICY IF EXISTS "Athletes can manage their own profile" ON public.athlete_profiles;
DROP POLICY IF EXISTS "Connected clinicians can view athlete profiles" ON public.athlete_profiles;

-- Create comprehensive athlete profiles policies
CREATE POLICY "Athletes can manage their own profile" ON public.athlete_profiles
  FOR ALL USING (auth.uid() = athlete_id);

CREATE POLICY "Clinicians can view connected athlete profiles" ON public.athlete_profiles
  FOR SELECT TO authenticated USING (
    -- Athletes can view their own profile
    auth.uid() = athlete_id OR
    -- Clinicians can view profiles of athletes they're connected to
    EXISTS (
      SELECT 1 FROM public.follow_relationships 
      WHERE athlete_id = athlete_profiles.athlete_id 
        AND clinician_id = auth.uid() 
        AND status = 'accepted'
    )
  );

-- =============================================================================
-- EVENTS POLICIES
-- =============================================================================

-- Drop existing events policies
DROP POLICY IF EXISTS "Everyone can view public events" ON public.events;
DROP POLICY IF EXISTS "Clinicians can manage their own events" ON public.events;

-- Create comprehensive events policies
CREATE POLICY "Public can view public events" ON public.events
  FOR SELECT TO authenticated USING (
    -- Public events are visible to all
    NOT is_private OR 
    -- Event owner can see their own events
    clinician_id = auth.uid() OR 
    -- Athletes with private access can see private events
    EXISTS (
      SELECT 1 FROM public.private_event_access 
      WHERE event_id = events.event_id AND athlete_id = auth.uid()
    )
  );

CREATE POLICY "Clinicians can manage their own events" ON public.events
  FOR ALL USING (auth.uid() = clinician_id);

-- =============================================================================
-- EVENT REGISTRATIONS POLICIES
-- =============================================================================

-- Drop existing event registrations policies
DROP POLICY IF EXISTS "Users can view their own registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Athletes can register for events" ON public.event_registrations;
DROP POLICY IF EXISTS "Athletes can update their registrations" ON public.event_registrations;

-- Create comprehensive event registrations policies
CREATE POLICY "Users can view relevant registrations" ON public.event_registrations
  FOR SELECT USING (
    -- Athletes can view their own registrations
    auth.uid() = athlete_id OR 
    -- Clinicians can view registrations for their events
    auth.uid() = (SELECT clinician_id FROM public.events WHERE event_id = event_registrations.event_id)
  );

CREATE POLICY "Athletes can register for events" ON public.event_registrations
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update relevant registrations" ON public.event_registrations
  FOR UPDATE USING (
    -- Athletes can update their own registrations
    auth.uid() = athlete_id OR
    -- Clinicians can update registrations for their events (payment status, etc.)
    auth.uid() = (SELECT clinician_id FROM public.events WHERE event_id = event_registrations.event_id)
  );

CREATE POLICY "Users can delete relevant registrations" ON public.event_registrations
  FOR DELETE USING (
    -- Athletes can cancel their own registrations
    auth.uid() = athlete_id OR
    -- Clinicians can remove registrations from their events
    auth.uid() = (SELECT clinician_id FROM public.events WHERE event_id = event_registrations.event_id)
  );

-- =============================================================================
-- FOLLOW RELATIONSHIPS POLICIES
-- =============================================================================

-- Drop existing follow relationships policies
DROP POLICY IF EXISTS "Users can view relevant follow relationships" ON public.follow_relationships;
DROP POLICY IF EXISTS "Athletes can create follow requests" ON public.follow_relationships;
DROP POLICY IF EXISTS "Users can update their follow relationships" ON public.follow_relationships;

-- Create comprehensive follow relationships policies
CREATE POLICY "Users can view their follow relationships" ON public.follow_relationships
  FOR SELECT USING (auth.uid() = athlete_id OR auth.uid() = clinician_id);

CREATE POLICY "Athletes can create follow requests" ON public.follow_relationships
  FOR INSERT WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Users can update their follow relationships" ON public.follow_relationships
  FOR UPDATE USING (auth.uid() = athlete_id OR auth.uid() = clinician_id);

CREATE POLICY "Users can delete their follow relationships" ON public.follow_relationships
  FOR DELETE USING (auth.uid() = athlete_id OR auth.uid() = clinician_id);

-- =============================================================================
-- MESSAGES POLICIES
-- =============================================================================

-- Drop existing messages policies
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to connected users" ON public.messages;
DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;

-- Create comprehensive messages policies
CREATE POLICY "Users can view their messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Connected users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
      -- Allow messages between connected users (athlete <-> clinician)
      EXISTS (
        SELECT 1 FROM public.follow_relationships 
        WHERE ((athlete_id = sender_id AND clinician_id = receiver_id) OR
               (athlete_id = receiver_id AND clinician_id = sender_id)) 
          AND status = 'accepted'
      ) OR
      -- Allow users to message themselves (system messages, etc.)
      sender_id = receiver_id
    )
  );

CREATE POLICY "Users can update their received messages" ON public.messages
  FOR UPDATE USING (auth.uid() = receiver_id);

CREATE POLICY "Users can delete their messages" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- =============================================================================
-- PRIVATE EVENT ACCESS POLICIES
-- =============================================================================

-- Drop existing private event access policies
DROP POLICY IF EXISTS "Clinicians can manage private event access" ON public.private_event_access;
DROP POLICY IF EXISTS "Athletes can view their private event access" ON public.private_event_access;

-- Create comprehensive private event access policies
CREATE POLICY "Event owners can manage private access" ON public.private_event_access
  FOR ALL USING (
    auth.uid() = (SELECT clinician_id FROM public.events WHERE event_id = private_event_access.event_id)
  );

CREATE POLICY "Athletes can view their private access" ON public.private_event_access
  FOR SELECT USING (auth.uid() = athlete_id);

-- =============================================================================
-- LOOKUP TABLES POLICIES
-- =============================================================================

-- Drop existing lookup table policies
DROP POLICY IF EXISTS "Anyone can view specialties" ON public.specialties_lookup;
DROP POLICY IF EXISTS "Authenticated users can add specialties" ON public.specialties_lookup;
DROP POLICY IF EXISTS "Anyone can view schools" ON public.schools_lookup;
DROP POLICY IF EXISTS "Authenticated users can add schools" ON public.schools_lookup;

-- Create comprehensive lookup table policies
CREATE POLICY "All authenticated users can view specialties" ON public.specialties_lookup
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can add specialties" ON public.specialties_lookup
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can view schools" ON public.schools_lookup
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can add schools" ON public.schools_lookup
  FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================================
-- SOCIAL FEATURES POLICIES (if you plan to use them)
-- =============================================================================

-- Drop existing social posts policies
DROP POLICY IF EXISTS "Everyone can view social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Users can manage their own social posts" ON public.social_posts;

-- Create comprehensive social posts policies
CREATE POLICY "Authenticated users can view social posts" ON public.social_posts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage their own social posts" ON public.social_posts
  FOR ALL USING (auth.uid() = user_id);

-- Drop existing post likes policies
DROP POLICY IF EXISTS "Users can view post likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;

-- Create comprehensive post likes policies
CREATE POLICY "Authenticated users can view post likes" ON public.post_likes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can like posts" ON public.post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts" ON public.post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- NEWS POSTS POLICIES
-- =============================================================================

-- Drop existing news posts policies
DROP POLICY IF EXISTS "Everyone can read published news" ON public.news_posts;
DROP POLICY IF EXISTS "Authors can manage their news posts" ON public.news_posts;

-- Create comprehensive news posts policies
CREATE POLICY "All can read published news" ON public.news_posts
  FOR SELECT TO authenticated USING (published = true OR auth.uid() = author_id);

CREATE POLICY "Authors can manage their news posts" ON public.news_posts
  FOR ALL USING (auth.uid() = author_id);

-- =============================================================================
-- VERIFICATION AND DEBUGGING
-- =============================================================================

-- Create a function to help debug RLS issues
CREATE OR REPLACE FUNCTION debug_user_access()
RETURNS TABLE(
  user_id UUID,
  user_role text,
  can_view_clinicians boolean,
  can_view_athletes boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid(),
    (SELECT role::text FROM public.users WHERE user_id = auth.uid()),
    EXISTS(SELECT 1 FROM public.clinician_profiles LIMIT 1),
    EXISTS(SELECT 1 FROM public.athlete_profiles LIMIT 1);
END;
$$; 