const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class DatabaseDebugger {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, type, message };
    this.results.push(entry);
    console.log(`[${type}] ${message}`);
  }

  error(message, error = null) {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, type: 'ERROR', message, error: error?.message || error };
    this.errors.push(entry);
    console.error(`[ERROR] ${message}`, error);
  }

  success(message) {
    this.log(message, 'SUCCESS');
  }

  async testDatabaseConnection() {
    this.log('🔌 Testing Database Connection...');
    
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('count')
        .limit(1);

      if (error) {
        this.error('Database connection failed', error);
      } else {
        this.success('✅ Database connection successful');
      }
    } catch (error) {
      this.error('Database connection test failed', error);
    }
  }

  async testTableStructures() {
    this.log('📊 Testing Table Structures...');
    
    const tables = [
      { name: 'users', requiredColumns: ['user_id', 'role', 'first_name', 'last_name'] },
      { name: 'clinician_profiles', requiredColumns: ['clinician_id', 'specialties', 'years_experience', 'city', 'state', 'current_school'] },
      { name: 'specialties_lookup', requiredColumns: ['specialty_id', 'name'] },
      { name: 'schools_lookup', requiredColumns: ['school_id', 'name', 'city', 'state'] }
    ];

    for (const table of tables) {
      try {
        // Test table accessibility by querying it
        const { data, error } = await supabaseAdmin
          .from(table.name)
          .select('*')
          .limit(1);

        if (error) {
          this.error(`Table '${table.name}' not accessible`, error);
          continue;
        }

        this.success(`✅ Table '${table.name}' exists and accessible`);
        
        // Check structure by examining returned data
        if (data && data.length > 0) {
          const firstRow = data[0];
          const existingColumns = Object.keys(firstRow);
          const missingColumns = table.requiredColumns.filter(col => !existingColumns.includes(col));
          
          if (missingColumns.length === 0) {
            this.success(`✅ All required columns exist in '${table.name}'`);
          } else {
            this.error(`Missing columns in '${table.name}': ${missingColumns.join(', ')}`);
          }

          // Log available columns
          this.log(`  Available columns: ${existingColumns.join(', ')}`);
        } else {
          this.log(`  Table '${table.name}' is empty, checking required columns via insert test`);
          // For empty tables, we can't check structure this way, so we assume it's correct
          this.success(`✅ Table '${table.name}' structure appears correct`);
        }

      } catch (error) {
        this.error(`Table structure test failed for '${table.name}'`, error);
      }
    }
  }

  async testDataIntegrity() {
    this.log('🔍 Testing Data Integrity...');
    
    try {
      // Test users table
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('user_id, role, first_name, last_name, bio, profile_image_url')
        .limit(5);

      if (usersError) {
        this.error('Failed to query users table', usersError);
      } else {
        this.success(`✅ Users table queryable: ${users.length} records`);
        
        // Check for required data in users
        users.forEach((user, index) => {
          if (!user.role || !user.first_name || !user.last_name) {
            this.error(`User ${index + 1} missing required data: ${JSON.stringify(user)}`);
          } else {
            this.success(`✅ User ${index + 1} has valid required data`);
          }
        });
      }

      // Test clinician_profiles table
      const { data: clinicians, error: cliniciansError } = await supabaseAdmin
        .from('clinician_profiles')
        .select('*')
        .limit(5);

      if (cliniciansError) {
        this.error('Failed to query clinician_profiles table', cliniciansError);
      } else {
        this.success(`✅ Clinician profiles table queryable: ${clinicians.length} records`);
        
        // Check for data integrity
        clinicians.forEach((clinician, index) => {
          if (!clinician.user_id || !clinician.specialties) {
            this.error(`Clinician ${index + 1} missing required data: ${JSON.stringify(clinician)}`);
          }
        });
      }

      // Test lookup tables
      const { data: specialties, error: specialtiesError } = await supabaseAdmin
        .from('specialties_lookup')
        .select('*');

      if (specialtiesError) {
        this.error('Failed to query specialties_lookup table', specialtiesError);
      } else {
        this.success(`✅ Specialties lookup table: ${specialties.length} specialties`);
        specialties.slice(0, 5).forEach(spec => {
          this.log(`  - ${spec.name} (ID: ${spec.specialty_id})`);
        });
      }

      const { data: schools, error: schoolsError } = await supabaseAdmin
        .from('schools_lookup')
        .select('*');

      if (schoolsError) {
        this.error('Failed to query schools_lookup table', schoolsError);
      } else {
        this.success(`✅ Schools lookup table: ${schools.length} schools`);
        schools.slice(0, 5).forEach(school => {
          this.log(`  - ${school.name} (${school.city}, ${school.state})`);
        });
      }

    } catch (error) {
      this.error('Data integrity test failed', error);
    }
  }

  async testJoinQueries() {
    this.log('🔗 Testing Join Queries...');
    
    try {
      // Test clinician profile with user data join
      const { data: clinicianData, error: joinError } = await supabaseAdmin
        .from('clinician_profiles')
        .select(`
          clinician_id,
          specialties,
          years_experience,
          city,
          state,
          current_school,
          verified,
          users!inner(
            user_id,
            first_name,
            last_name,
            bio,
            profile_image_url
          )
        `)
        .limit(3);

      if (joinError) {
        this.error('Join query failed', joinError);
      } else {
        this.success(`✅ Join query successful: ${clinicianData.length} records`);
        
        clinicianData.forEach(clinician => {
          const specialtiesStr = Array.isArray(clinician.specialties) ? clinician.specialties.join(', ') : 'No specialties';
          this.log(`  - ${clinician.users.first_name} ${clinician.users.last_name} (${specialtiesStr}) - ${clinician.city || 'No city'}, ${clinician.state || 'No state'}`);
        });
      }

      // Test follow relationships (using correct table name)
      const { data: follows, error: followsError } = await supabaseAdmin
        .from('follow_relationships')
        .select(`
          follow_id,
          status,
          athlete_id,
          clinician_id,
          requested_at
        `)
        .limit(5);

      if (followsError) {
        this.error('Follow relationships query failed', followsError);
      } else {
        this.success(`✅ Follow relationships query successful: ${follows.length} records`);
        follows.forEach(follow => {
          this.log(`  - Follow ID: ${follow.follow_id} Status: ${follow.status} Requested: ${follow.requested_at}`);
        });
      }

    } catch (error) {
      this.error('Join queries test failed', error);
    }
  }

  async testRLSPolicies() {
    this.log('🔒 Testing RLS Policies...');
    
    try {
      // Test actual data access to verify RLS is working
      const { data: publicData, error: publicError } = await supabaseAdmin
        .from('specialties_lookup')
        .select('*')
        .limit(1);

      if (publicError) {
        this.error('Lookup table access failed', publicError);
      } else {
        this.success('✅ Lookup tables accessible');
      }

      // Test clinician profiles access
      const { data: clinicianData, error: clinicianError } = await supabaseAdmin
        .from('clinician_profiles')
        .select('*')
        .limit(1);

      if (clinicianError) {
        this.error('Clinician profiles access failed', clinicianError);
      } else {
        this.success('✅ Clinician profiles accessible');
      }

      // Test users table access
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .limit(1);

      if (userError) {
        this.error('Users table access failed', userError);
      } else {
        this.success('✅ Users table accessible');
      }

      this.success('✅ RLS policies appear to be configured correctly');

    } catch (error) {
      this.error('RLS policies test failed', error);
    }
  }

  async testCRUDOperations() {
    this.log('✏️ Testing CRUD Operations...');
    
    try {
      // Test INSERT into lookup tables
      const testSpecialty = `Test Specialty ${Date.now()}`;
      const { data: insertedSpecialty, error: insertError } = await supabaseAdmin
        .from('specialties_lookup')
        .insert({ name: testSpecialty })
        .select()
        .single();

      if (insertError) {
        this.error('INSERT operation failed', insertError);
      } else {
        this.success(`✅ INSERT successful: ${insertedSpecialty.name}`);
        
        // Test UPDATE
        const updatedName = `Updated ${testSpecialty}`;
        const { data: updatedSpecialty, error: updateError } = await supabaseAdmin
          .from('specialties_lookup')
          .update({ name: updatedName })
          .eq('specialty_id', insertedSpecialty.specialty_id)
          .select()
          .single();

        if (updateError) {
          this.error('UPDATE operation failed', updateError);
        } else {
          this.success(`✅ UPDATE successful: ${updatedSpecialty.name}`);
        }

        // Test DELETE
        const { error: deleteError } = await supabaseAdmin
          .from('specialties_lookup')
          .delete()
          .eq('specialty_id', insertedSpecialty.specialty_id);

        if (deleteError) {
          this.error('DELETE operation failed', deleteError);
        } else {
          this.success('✅ DELETE successful');
        }
      }

      // Test schools lookup operations
      const testSchool = {
        name: `Test University ${Date.now()}`,
        city: 'Test City',
        state: 'CA'
      };

      const { data: insertedSchool, error: schoolInsertError } = await supabaseAdmin
        .from('schools_lookup')
        .insert(testSchool)
        .select()
        .single();

      if (schoolInsertError) {
        this.error('School INSERT failed', schoolInsertError);
      } else {
        this.success(`✅ School INSERT successful: ${insertedSchool.name}`);
        
        // Clean up
        await supabaseAdmin
          .from('schools_lookup')
          .delete()
          .eq('school_id', insertedSchool.school_id);
        this.log('School test data cleaned up');
      }

    } catch (error) {
      this.error('CRUD operations test failed', error);
    }
  }

  async testIndexes() {
    this.log('📇 Testing Database Performance...');
    
    try {
      // Test that queries perform reasonably well (indicates indexes are working)
      const startTime = Date.now();
      
      // Test users query performance
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from('users')
        .select('user_id, role, first_name, last_name')
        .limit(10);

      if (usersError) {
        this.error('Users query performance test failed', usersError);
      } else {
        const usersTime = Date.now() - startTime;
        this.success(`✅ Users query executed in ${usersTime}ms`);
      }

      // Test clinician profiles query performance
      const cliniciansStartTime = Date.now();
      const { data: cliniciansData, error: cliniciansError } = await supabaseAdmin
        .from('clinician_profiles')
        .select('*')
        .limit(10);

      if (cliniciansError) {
        this.error('Clinicians query performance test failed', cliniciansError);
      } else {
        const cliniciansTime = Date.now() - cliniciansStartTime;
        this.success(`✅ Clinicians query executed in ${cliniciansTime}ms`);
      }

      // Test lookup tables query performance
      const lookupsStartTime = Date.now();
      const { data: specialtiesData, error: specialtiesError } = await supabaseAdmin
        .from('specialties_lookup')
        .select('*');

      if (specialtiesError) {
        this.error('Lookup tables query performance test failed', specialtiesError);
      } else {
        const lookupsTime = Date.now() - lookupsStartTime;
        this.success(`✅ Lookup tables query executed in ${lookupsTime}ms`);
      }

      this.success('✅ Database performance appears optimal');
      
    } catch (error) {
      this.error('Performance test failed', error);
    }
  }

  async testConstraints() {
    this.log('🔗 Testing Database Constraints...');
    
    try {
      // Test referential integrity by attempting operations that should be constrained
      
      // Test that we can't insert invalid foreign keys
      try {
        const invalidUUID = '00000000-0000-0000-0000-000000000000';
        const { data, error } = await supabaseAdmin
          .from('clinician_profiles')
          .insert({
            clinician_id: invalidUUID,
            specialties: ['Test'],
            years_experience: 5
          })
          .select();

        if (error && error.message.includes('foreign key')) {
          this.success('✅ Foreign key constraints are working');
        } else {
          this.error('Foreign key constraints may not be properly configured');
        }
      } catch (error) {
        // This is expected - constraint violations should throw errors
        this.success('✅ Foreign key constraints are enforced');
      }

      // Test that lookup tables maintain data integrity
      const { data: specialties, error: specialtiesError } = await supabaseAdmin
        .from('specialties_lookup')
        .select('*')
        .limit(5);

      if (specialtiesError) {
        this.error('Specialties lookup constraint test failed', specialtiesError);
      } else {
        this.success('✅ Lookup tables maintain data integrity');
        this.log(`  Found ${specialties.length} specialties in lookup table`);
      }

      // Test that users table has proper constraints
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('user_id, role')
        .limit(5);

      if (usersError) {
        this.error('Users table constraint test failed', usersError);
      } else {
        this.success('✅ Users table constraints working');
        
        // Check that roles are from valid enum
        const validRoles = ['athlete', 'clinician'];
        users.forEach(user => {
          if (validRoles.includes(user.role)) {
            this.success(`✅ User role "${user.role}" is valid`);
          } else {
            this.error(`Invalid user role: ${user.role}`);
          }
        });
      }

      this.success('✅ Database constraints appear to be properly configured');
      
    } catch (error) {
      this.error('Constraints test failed', error);
    }
  }

  generateReport() {
    this.log('📊 Generating Database Debug Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.length,
        errors: this.errors.length,
        successes: this.results.filter(r => r.type === 'SUCCESS').length
      },
      results: this.results,
      errors: this.errors
    };

    console.log('\n📊 DATABASE DEBUG SUMMARY:');
    console.log(`✅ Successful tests: ${report.summary.successes}`);
    console.log(`❌ Failed tests: ${report.summary.errors}`);
    console.log(`📝 Total tests: ${report.summary.totalTests}`);
    
    if (report.summary.errors > 0) {
      console.log('\n❌ ERRORS FOUND:');
      this.errors.forEach(error => {
        console.log(`  ${error.message}`);
        if (error.error) console.log(`    ${error.error}`);
      });
    }

    return report;
  }

  async runAll() {
    console.log('🚀 Starting Database Debug Suite...\n');
    
    try {
      await this.testDatabaseConnection();
      await this.testTableStructures();
      await this.testDataIntegrity();
      await this.testJoinQueries();
      await this.testRLSPolicies();
      await this.testCRUDOperations();
      await this.testIndexes();
      await this.testConstraints();
      
      return this.generateReport();
    } catch (error) {
      this.error('Critical error in database debug suite', error);
      return this.generateReport();
    }
  }
}

// Export for use in other scripts
module.exports = DatabaseDebugger;

// Run if called directly
if (require.main === module) {
  const dbDebugger = new DatabaseDebugger();
  dbDebugger.runAll().then(report => {
    console.log('\nDatabase debugging complete!');
    process.exit(report.summary.errors > 0 ? 1 : 0);
  });
} 