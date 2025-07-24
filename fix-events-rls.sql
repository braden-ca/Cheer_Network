-- Fix RLS Policies for Events Table
-- This script resolves the "infinite recursion detected in policy" error
-- Run this directly in your Supabase SQL Editor

-- =============================================================================
-- DROP PROBLEMATIC POLICIES
-- =============================================================================

-- Drop existing problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Everyone can view public events" ON public.events;
DROP POLICY IF EXISTS "Public can view public events" ON public.events;
DROP POLICY IF EXISTS "Clinicians can manage their own events" ON public.events;

-- =============================================================================
-- CREATE SIMPLE NON-RECURSIVE POLICIES
-- =============================================================================

-- Create a simple policy for viewing events (no recursion)
CREATE POLICY "Simple event view policy" ON public.events
  FOR SELECT TO authenticated USING (
    NOT is_private OR 
    clinician_id = auth.uid()
  );

-- Create a simple policy for clinicians to manage their own events
CREATE POLICY "Clinicians manage own events" ON public.events
  FOR ALL TO authenticated USING (
    auth.uid() = clinician_id
  ) WITH CHECK (
    auth.uid() = clinician_id
  );

-- =============================================================================
-- VERIFY POLICIES
-- =============================================================================

-- You can run this to verify the policies were created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'events';

-- =============================================================================
-- TEST THE FIX
-- =============================================================================

-- This should work without infinite recursion now
-- (You can test this after running the above policies)
-- SELECT * FROM events LIMIT 1; 