const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixEventsRLS() {
  try {
    console.log('🔧 Fixing events RLS policies...');
    
    // Since exec_sql doesn't exist, let's try to temporarily disable RLS
    // and then recreate the policies properly
    
    // First, let's try to create a simple policy that doesn't cause recursion
    const simplePolicySQL = `
      -- Drop existing problematic policies
      DROP POLICY IF EXISTS "Everyone can view public events" ON public.events;
      DROP POLICY IF EXISTS "Public can view public events" ON public.events;
      DROP POLICY IF EXISTS "Clinicians can manage their own events" ON public.events;
      
      -- Create a simple non-recursive policy for viewing events
      CREATE POLICY "Simple event view policy" ON public.events
        FOR SELECT TO authenticated USING (
          NOT is_private OR 
          clinician_id = auth.uid()
        );
      
      -- Create a simple policy for clinicians to insert/update/delete their own events
      CREATE POLICY "Clinicians manage own events" ON public.events
        FOR ALL TO authenticated USING (
          auth.uid() = clinician_id
        ) WITH CHECK (
          auth.uid() = clinician_id
        );
    `;
    
    // Try to execute using a different approach
    console.log('Attempting to fix policies...');
    
    // Test basic database connection
    const { data, error } = await supabase
      .from('events')
      .select('event_id')
      .limit(1);
    
    if (error) {
      console.error('Database connection error:', error);
      return;
    }
    
    console.log('✅ Database connection successful');
    console.log('⚠️  Note: Cannot directly execute SQL DDL statements with this client');
    console.log('💡 Alternative: Please run the following SQL directly in your Supabase dashboard:');
    console.log(simplePolicySQL);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixEventsRLS(); 