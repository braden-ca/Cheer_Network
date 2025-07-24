const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyFix() {
  console.log('🔍 Verifying database fix...\n');
  
  // Check if lookup tables now exist
  try {
    const { data: specialties, error: specError } = await supabase
      .from('specialties_lookup')
      .select('*')
      .limit(5);
      
    if (specError) {
      console.log('❌ Specialties lookup:', specError.message);
    } else {
      console.log(`✅ Specialties lookup: ${specialties.length} entries available`);
      console.log('   Sample specialties:', specialties.map(s => s.name).join(', '));
    }
  } catch (err) {
    console.log('❌ Specialties lookup:', err.message);
  }
  
  try {
    const { data: schools, error: schoolError } = await supabase
      .from('schools_lookup')
      .select('*')
      .limit(5);
      
    if (schoolError) {
      console.log('❌ Schools lookup:', schoolError.message);
    } else {
      console.log(`✅ Schools lookup: ${schools.length} entries available`);
      console.log('   Sample schools:', schools.map(s => s.name).join(', '));
    }
  } catch (err) {
    console.log('❌ Schools lookup:', err.message);
  }
  
  // Test clinician profiles access
  try {
    const { data: clinicians, error: clinError } = await supabase
      .from('clinician_profiles')
      .select(`
        *,
        users!inner(user_id, first_name, last_name, bio, profile_image_url)
      `)
      .limit(3);
      
    if (clinError) {
      console.log('❌ Clinician profiles access:', clinError.message);
    } else {
      console.log(`✅ Clinician profiles: ${clinicians.length} coaches accessible`);
      clinicians.forEach(c => {
        const user = Array.isArray(c.users) ? c.users[0] : c.users;
        console.log(`   - ${user.first_name} ${user.last_name} (${c.specialties?.join(', ') || 'No specialties'})`);
      });
    }
  } catch (err) {
    console.log('❌ Clinician profiles access:', err.message);
  }
  
  console.log('\n🎉 Verification complete!');
  console.log('\nIf all items show ✅, your database is properly configured.');
  console.log('You can now refresh your athlete dashboard to test the "View Profile" feature.');
}

verifyFix(); 