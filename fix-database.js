const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDatabase() {
  console.log('🔧 Fixing database schema issues...');

  try {
    // Create specialties_lookup table
    console.log('📝 Creating specialties_lookup table...');
    const { error: specialtiesTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.specialties_lookup (
          specialty_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (specialtiesTableError) {
      console.log('⚠️ Note: exec_sql not available, trying alternative approach...');
      
      // Try direct table creation without exec_sql
      const { error: directSpecialtiesError } = await supabase
        .from('specialties_lookup')
        .select('*')
        .limit(1);
      
      if (directSpecialtiesError && directSpecialtiesError.code === '42P01') {
        console.log('❌ specialties_lookup table does not exist and cannot be created via API');
        console.log('   Please create the table manually in Supabase SQL editor');
      } else {
        console.log('✅ specialties_lookup table exists or was created');
      }
    } else {
      console.log('✅ specialties_lookup table created successfully');
    }

    // Create schools_lookup table
    console.log('📝 Creating schools_lookup table...');
    const { error: schoolsTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.schools_lookup (
          school_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          city TEXT,
          state TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (schoolsTableError) {
      console.log('⚠️ Note: Using alternative approach for schools_lookup...');
      
      const { error: directSchoolsError } = await supabase
        .from('schools_lookup')
        .select('*')
        .limit(1);
      
      if (directSchoolsError && directSchoolsError.code === '42P01') {
        console.log('❌ schools_lookup table does not exist and cannot be created via API');
        console.log('   Please create the table manually in Supabase SQL editor');
      } else {
        console.log('✅ schools_lookup table exists or was created');
      }
    } else {
      console.log('✅ schools_lookup table created successfully');
    }

    // Try to add missing columns to clinician_profiles
    console.log('📝 Attempting to add missing fields to clinician_profiles...');
    const { error: alterTableError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'clinician_profiles' AND column_name = 'city') THEN
            ALTER TABLE public.clinician_profiles ADD COLUMN city TEXT;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'clinician_profiles' AND column_name = 'state') THEN
            ALTER TABLE public.clinician_profiles ADD COLUMN state TEXT;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name = 'clinician_profiles' AND column_name = 'current_school') THEN
            ALTER TABLE public.clinician_profiles ADD COLUMN current_school TEXT;
          END IF;
        END $$;
      `
    });

    if (alterTableError) {
      console.log('⚠️ Could not add columns via exec_sql, columns may need to be added manually');
    } else {
      console.log('✅ Missing columns added to clinician_profiles');
    }

    // Try to insert sample data
    console.log('📝 Inserting sample specialties...');
    const specialties = [
      'Tumbling', 'Stunting', 'Choreography', 'Flexibility Training',
      'Strength & Conditioning', 'Competition Prep', 'Team Building', 'Performance Coaching'
    ];

    for (const specialty of specialties) {
      try {
        const { error: insertError } = await supabase
          .from('specialties_lookup')
          .insert({ name: specialty })
          .select();
        
        if (insertError && !insertError.message.includes('duplicate')) {
          console.log(`⚠️ Could not insert specialty: ${specialty}`);
        }
      } catch (error) {
        // Ignore errors for now, table might not exist
      }
    }

    console.log('📝 Inserting sample schools...');
    const schools = [
      { name: 'University of Alabama', city: 'Tuscaloosa', state: 'AL' },
      { name: 'University of Kentucky', city: 'Lexington', state: 'KY' },
      { name: 'University of Oklahoma', city: 'Norman', state: 'OK' },
      { name: 'University of Tennessee', city: 'Knoxville', state: 'TN' },
      { name: 'University of Florida', city: 'Gainesville', state: 'FL' }
    ];

    for (const school of schools) {
      try {
        const { error: insertError } = await supabase
          .from('schools_lookup')
          .insert(school)
          .select();
        
        if (insertError && !insertError.message.includes('duplicate')) {
          console.log(`⚠️ Could not insert school: ${school.name}`);
        }
      } catch (error) {
        // Ignore errors for now, table might not exist
      }
    }

    // Test if fixes worked
    console.log('🧪 Testing fixes...');
    
    // Test specialties_lookup
    const { data: specialtiesData, error: specialtiesTestError } = await supabase
      .from('specialties_lookup')
      .select('*')
      .limit(3);

    if (specialtiesTestError) {
      console.log('❌ specialties_lookup table still not accessible');
    } else {
      console.log(`✅ specialties_lookup working: ${specialtiesData.length} records found`);
    }

    // Test schools_lookup
    const { data: schoolsData, error: schoolsTestError } = await supabase
      .from('schools_lookup')
      .select('*')
      .limit(3);

    if (schoolsTestError) {
      console.log('❌ schools_lookup table still not accessible');
    } else {
      console.log(`✅ schools_lookup working: ${schoolsData.length} records found`);
    }

    // Test clinician_profiles with new fields
    const { data: clinicianData, error: clinicianTestError } = await supabase
      .from('clinician_profiles')
      .select('clinician_id, city, state, current_school')
      .limit(1);

    if (clinicianTestError) {
      console.log('❌ clinician_profiles fields still not accessible');
      console.log('   Error:', clinicianTestError.message);
    } else {
      console.log('✅ clinician_profiles new fields working');
      if (clinicianData && clinicianData.length > 0) {
        const fields = Object.keys(clinicianData[0]);
        console.log('   Available fields:', fields.join(', '));
      }
    }

    console.log('\n🎉 Database fix attempt completed!');
    console.log('\n📋 Manual steps if issues persist:');
    console.log('1. Go to Supabase Dashboard > SQL Editor');
    console.log('2. Run the contents of fix-database-schema.sql');
    console.log('3. Ensure RLS policies are properly configured');
    console.log('4. Run the debug suite again: node debug-master.js');

  } catch (error) {
    console.error('❌ Database fix failed:', error);
  }
}

// Run the fix
fixDatabase(); 