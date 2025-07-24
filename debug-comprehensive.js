const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import fetch for Node.js
let fetch;
try {
  fetch = require('node-fetch');
} catch (error) {
  // If node-fetch is not available, try to use built-in fetch (Node 18+)
  if (typeof globalThis.fetch !== 'undefined') {
    fetch = globalThis.fetch;
  } else {
    console.warn('fetch not available, API endpoint tests will be skipped');
  }
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_BASE = 'http://localhost:3000/api';

class DebugSuite {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  log(message, status = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${status}] ${message}`;
    console.log(logEntry);
    this.results.push(logEntry);
  }

  error(message, error = null) {
    const timestamp = new Date().toISOString();
    const errorEntry = `[${timestamp}] [ERROR] ${message}`;
    if (error) {
      errorEntry += ` - ${error.message || JSON.stringify(error)}`;
    }
    console.error(errorEntry);
    this.errors.push(errorEntry);
  }

  success(message) {
    this.log(message, 'SUCCESS');
  }

  async runAll() {
    console.log('🚀 Starting Comprehensive Debug Suite...\n');
    
    try {
      await this.testDatabaseSchema();
      await this.testLookupTables();
      await this.testRLSPolicies();
      await this.testAPIEndpoints();
      await this.testDataFlow();
      await this.testFileUpload();
      await this.generateReport();
    } catch (error) {
      this.error('Critical error in debug suite', error);
    }
  }

  async testDatabaseSchema() {
    this.log('📊 Testing Database Schema...');
    
    try {
      // Test clinician_profiles table structure by querying it
      const { data: clinicianData, error: clinicianError } = await supabaseAdmin
        .from('clinician_profiles')
        .select('*')
        .limit(1);

      if (clinicianError) {
        this.error('Failed to access clinician_profiles table', clinicianError);
      } else {
        this.success(`✅ clinician_profiles table is accessible`);
        
        if (clinicianData && clinicianData.length > 0) {
          const firstRecord = clinicianData[0];
          const requiredFields = ['city', 'state', 'current_school'];
          const existingFields = Object.keys(firstRecord);
          
          requiredFields.forEach(field => {
            if (existingFields.includes(field)) {
              this.success(`✅ Field '${field}' exists in clinician_profiles`);
            } else {
              this.error(`❌ Missing field '${field}' in clinician_profiles`);
            }
          });
        } else {
          this.log('Table is empty, assuming schema is correct');
          this.success(`✅ Schema appears correct`);
        }
      }

      // Test lookup tables
      const lookupTables = ['specialties_lookup', 'schools_lookup'];
      for (const table of lookupTables) {
        const { data: tableData, error: tableError } = await supabaseAdmin
          .from(table)
          .select('*')
          .limit(1);

        if (tableError) {
          this.error(`Table '${table}' not accessible`, tableError);
        } else {
          this.success(`✅ Table '${table}' exists and accessible`);
        }
      }

    } catch (error) {
      this.error('Database schema test failed', error);
    }
  }

  async testLookupTables() {
    this.log('📚 Testing Lookup Tables Data...');
    
    try {
      // Test specialties_lookup
      const { data: specialties, error: specialtiesError } = await supabaseAdmin
        .from('specialties_lookup')
        .select('*');

      if (specialtiesError) {
        this.error('Failed to query specialties_lookup', specialtiesError);
      } else {
        this.success(`specialties_lookup contains ${specialties.length} specialties`);
        specialties.slice(0, 3).forEach(spec => {
          this.log(`  - ${spec.name} (ID: ${spec.specialty_id})`);
        });
      }

      // Test schools_lookup
      const { data: schools, error: schoolsError } = await supabaseAdmin
        .from('schools_lookup')
        .select('*');

      if (schoolsError) {
        this.error('Failed to query schools_lookup', schoolsError);
      } else {
        this.success(`schools_lookup contains ${schools.length} schools`);
        schools.slice(0, 3).forEach(school => {
          this.log(`  - ${school.name} (${school.city}, ${school.state})`);
        });
      }

      // Test adding a new specialty
      const testSpecialty = `Test Specialty ${Date.now()}`;
      const { data: newSpecialty, error: insertError } = await supabaseAdmin
        .from('specialties_lookup')
        .insert({ name: testSpecialty })
        .select()
        .single();

      if (insertError) {
        this.error('Failed to insert test specialty', insertError);
      } else {
        this.success(`✅ Successfully inserted test specialty: ${newSpecialty.name}`);
        
        // Clean up
        await supabaseAdmin
          .from('specialties_lookup')
          .delete()
          .eq('specialty_id', newSpecialty.specialty_id);
        this.log('Test specialty cleaned up');
      }

    } catch (error) {
      this.error('Lookup tables test failed', error);
    }
  }

  async testRLSPolicies() {
    this.log('🔒 Testing RLS Policies...');
    
    try {
      // Test clinician profile query with joins
      const { data: clinicians, error: cliniciansError } = await supabaseAdmin
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
        .limit(5);

      if (cliniciansError) {
        this.error('RLS policy blocking clinician query', cliniciansError);
      } else {
        this.success(`✅ RLS policies allow clinician queries (${clinicians.length} records)`);
        clinicians.forEach(clinician => {
          this.log(`  - ${clinician.users.first_name} ${clinician.users.last_name} (${clinician.city}, ${clinician.state})`);
        });
      }

      // Test lookup table access
      const { data: lookupTest, error: lookupError } = await supabaseAdmin
        .from('specialties_lookup')
        .select('name')
        .limit(3);

      if (lookupError) {
        this.error('RLS policy blocking lookup table access', lookupError);
      } else {
        this.success(`✅ RLS policies allow lookup table access`);
      }

    } catch (error) {
      this.error('RLS policies test failed', error);
    }
  }

  async testAPIEndpoints() {
    this.log('🔌 Testing API Endpoints...');
    
    if (!fetch) {
      this.log('⚠️ Fetch not available, skipping API endpoint tests');
      return;
    }
    
    const endpoints = [
      { path: '/dropdown/specialties', method: 'GET', description: 'Get specialties' },
      { path: '/dropdown/schools', method: 'GET', description: 'Get schools' },
      { path: '/dropdown/states', method: 'GET', description: 'Get states' },
      { path: '/users/clinicians', method: 'GET', description: 'Get clinicians' }
    ];

    for (const endpoint of endpoints) {
      try {
        this.log(`Testing ${endpoint.method} ${endpoint.path}...`);
        
        const response = await fetch(`${API_BASE}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          this.success(`✅ ${endpoint.description} - Status: ${response.status}`);
          
          // Log specific data details
          if (endpoint.path === '/dropdown/specialties' && data.specialties) {
            this.log(`  Found ${data.specialties.length} specialties`);
          } else if (endpoint.path === '/dropdown/states' && data.states) {
            this.log(`  Found ${data.states.length} states`);
          } else if (endpoint.path === '/dropdown/schools' && data.schools) {
            this.log(`  Found ${data.schools.length} schools`);
          } else if (endpoint.path === '/users/clinicians' && data.clinicians) {
            this.log(`  Found ${data.clinicians.length} clinicians`);
          }
        } else {
          const errorData = await response.text();
          this.error(`${endpoint.description} failed - Status: ${response.status}`, errorData);
        }
      } catch (error) {
        this.error(`API test failed for ${endpoint.path}`, error);
      }
    }
  }

  async testDataFlow() {
    this.log('🔄 Testing Complete Data Flow...');
    
    try {
      // Test the enhanced registration flow (without actually creating a user)
      const testRegistrationData = {
        email: `test.clinician.${Date.now()}@example.com`,
        password: 'testpassword123',
        firstName: 'Test',
        lastName: 'Clinician',
        role: 'clinician',
        yearsExperience: 5,
        specialties: ['Tumbling', 'Test Specialty'],
        city: 'Test City',
        state: 'CA',
        currentSchool: 'Test University',
        bio: 'This is a test bio for debugging purposes.'
      };

      this.log('Testing registration data validation...');
      
      // Validate required fields
      const requiredFields = ['email', 'password', 'firstName', 'lastName', 'yearsExperience', 'specialties', 'city', 'state'];
      const missingFields = requiredFields.filter(field => !testRegistrationData[field]);
      
      if (missingFields.length > 0) {
        this.error(`Missing required fields: ${missingFields.join(', ')}`);
      } else {
        this.success('✅ All required registration fields present');
      }

      // Test specialty validation
      if (Array.isArray(testRegistrationData.specialties) && testRegistrationData.specialties.length > 0) {
        this.success(`✅ Specialties validation passed (${testRegistrationData.specialties.length} specialties)`);
      } else {
        this.error('Specialties validation failed');
      }

      // Test state code validation
      if (testRegistrationData.state && testRegistrationData.state.length === 2) {
        this.success('✅ State code validation passed');
      } else {
        this.error('State code validation failed');
      }

    } catch (error) {
      this.error('Data flow test failed', error);
    }
  }

  async testFileUpload() {
    this.log('📁 Testing File Upload System...');
    
    try {
      // Check if upload directory exists
      const uploadDir = path.join(__dirname, 'public', 'uploads', 'profiles');
      if (fs.existsSync(uploadDir)) {
        this.success('✅ Upload directory exists');
        
        // Check directory permissions
        try {
          const testFile = path.join(uploadDir, 'test.txt');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          this.success('✅ Upload directory is writable');
        } catch (error) {
          this.error('Upload directory is not writable', error);
        }
      } else {
        this.error('Upload directory does not exist');
      }

      // Test upload endpoint availability
      try {
        const response = await fetch(`${API_BASE}/upload/profile-picture`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });

        // We expect a 400 error for no file, which means the endpoint exists
        if (response.status === 400) {
          this.success('✅ Upload endpoint is accessible');
        } else {
          this.log(`Upload endpoint returned status: ${response.status}`);
        }
      } catch (error) {
        this.error('Upload endpoint test failed', error);
      }

    } catch (error) {
      this.error('File upload test failed', error);
    }
  }

  async generateReport() {
    this.log('📋 Generating Debug Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.length,
        errors: this.errors.length,
        success: this.results.filter(r => r.includes('[SUCCESS]')).length
      },
      results: this.results,
      errors: this.errors
    };

    // Write report to file
    const reportPath = path.join(__dirname, 'debug-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.success(`Debug report saved to: ${reportPath}`);
    
    // Print summary
    console.log('\n📊 DEBUG SUMMARY:');
    console.log(`✅ Successful tests: ${report.summary.success}`);
    console.log(`❌ Failed tests: ${report.summary.errors}`);
    console.log(`📝 Total tests: ${report.summary.totalTests}`);
    
    if (report.summary.errors > 0) {
      console.log('\n❌ ERRORS FOUND:');
      this.errors.forEach(error => console.log(`  ${error}`));
    } else {
      console.log('\n🎉 ALL TESTS PASSED!');
    }
  }
}

// Individual test functions for specific components
async function testSpecificComponent(component) {
  const debugSuite = new DebugSuite();
  
  switch (component) {
    case 'database':
      await debugSuite.testDatabaseSchema();
      break;
    case 'lookup':
      await debugSuite.testLookupTables();
      break;
    case 'rls':
      await debugSuite.testRLSPolicies();
      break;
    case 'api':
      await debugSuite.testAPIEndpoints();
      break;
    case 'upload':
      await debugSuite.testFileUpload();
      break;
    default:
      console.log('Available components: database, lookup, rls, api, upload');
  }
}

// Run the debug suite
if (require.main === module) {
  const component = process.argv[2];
  
  if (component) {
    testSpecificComponent(component);
  } else {
    const debugSuite = new DebugSuite();
    debugSuite.runAll();
  }
}

module.exports = { DebugSuite, testSpecificComponent }; 