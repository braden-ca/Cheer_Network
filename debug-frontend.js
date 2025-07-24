// Frontend debugging script for testing form validation, API calls, and UI components
// This script can be run in the browser console or included in test pages

class FrontendDebugger {
  constructor() {
    this.results = [];
    this.errors = [];
    this.apiBase = 'http://localhost:3000/api';
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

  // Test API endpoints
  async testAPIEndpoints() {
    this.log('🔌 Testing Frontend API Endpoints...');
    
    const endpoints = [
      { url: '/dropdown/specialties', name: 'Specialties' },
      { url: '/dropdown/schools', name: 'Schools' },
      { url: '/dropdown/states', name: 'States' },
      { url: '/users/clinicians', name: 'Clinicians' }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.apiBase}${endpoint.url}`);
        const data = await response.json();
        
        if (response.ok) {
          this.success(`✅ ${endpoint.name} API working`);
          
          // Log data structure
          if (data.specialties) {
            this.log(`  Found ${data.specialties.length} specialties`);
          } else if (data.schools) {
            this.log(`  Found ${data.schools.length} schools`);
          } else if (data.states) {
            this.log(`  Found ${data.states.length} states`);
          } else if (data.clinicians) {
            this.log(`  Found ${data.clinicians.length} clinicians`);
          }
        } else {
          this.error(`${endpoint.name} API failed: ${response.status}`, data);
        }
      } catch (error) {
        this.error(`${endpoint.name} API error`, error);
      }
    }
  }

  // Test form validation
  testFormValidation() {
    this.log('📝 Testing Form Validation...');
    
    const testData = {
      email: 'test@example.com',
      password: 'testpass123',
      firstName: 'Test',
      lastName: 'User',
      yearsExperience: 5,
      specialties: ['Tumbling', 'Stunting'],
      city: 'Test City',
      state: 'CA',
      currentSchool: 'Test University'
    };

    // Test email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailPattern.test(testData.email)) {
      this.success('✅ Email validation passed');
    } else {
      this.error('Email validation failed');
    }

    // Test password validation
    if (testData.password.length >= 8) {
      this.success('✅ Password validation passed');
    } else {
      this.error('Password validation failed');
    }

    // Test specialties validation
    if (Array.isArray(testData.specialties) && testData.specialties.length > 0) {
      this.success('✅ Specialties validation passed');
    } else {
      this.error('Specialties validation failed');
    }

    // Test state validation
    if (testData.state && testData.state.length === 2) {
      this.success('✅ State validation passed');
    } else {
      this.error('State validation failed');
    }
  }

  // Test dynamic dropdown functionality
  async testDynamicDropdowns() {
    this.log('📋 Testing Dynamic Dropdowns...');
    
    try {
      // Test specialties dropdown
      const specialtiesResponse = await fetch(`${this.apiBase}/dropdown/specialties`);
      const specialtiesData = await specialtiesResponse.json();
      
      if (specialtiesResponse.ok && specialtiesData.specialties) {
        this.success(`✅ Specialties dropdown loaded: ${specialtiesData.specialties.length} options`);
        
        // Test if common specialties exist
        const commonSpecialties = ['Tumbling', 'Stunting', 'Jumps'];
        commonSpecialties.forEach(specialty => {
          const exists = specialtiesData.specialties.some(s => s.name === specialty);
          if (exists) {
            this.success(`✅ Found common specialty: ${specialty}`);
          } else {
            this.log(`⚠️ Missing common specialty: ${specialty}`);
          }
        });
      } else {
        this.error('Specialties dropdown failed to load');
      }

      // Test states dropdown
      const statesResponse = await fetch(`${this.apiBase}/dropdown/states`);
      const statesData = await statesResponse.json();
      
      if (statesResponse.ok && statesData.states) {
        this.success(`✅ States dropdown loaded: ${statesData.states.length} options`);
        
        // Test if common states exist
        const commonStates = ['CA', 'TX', 'FL', 'NY'];
        commonStates.forEach(state => {
          const exists = statesData.states.some(s => s.code === state);
          if (exists) {
            this.success(`✅ Found state: ${state}`);
          } else {
            this.error(`Missing state: ${state}`);
          }
        });
      } else {
        this.error('States dropdown failed to load');
      }

    } catch (error) {
      this.error('Dynamic dropdowns test failed', error);
    }
  }

  // Test school search functionality
  async testSchoolSearch() {
    this.log('🏫 Testing School Search...');
    
    try {
      // Test empty search
      const emptyResponse = await fetch(`${this.apiBase}/dropdown/schools`);
      const emptyData = await emptyResponse.json();
      
      if (emptyResponse.ok) {
        this.success('✅ Empty school search works');
        this.log(`  Returned ${emptyData.schools.length} schools`);
      }

      // Test search with query
      const searchResponse = await fetch(`${this.apiBase}/dropdown/schools?search=university`);
      const searchData = await searchResponse.json();
      
      if (searchResponse.ok) {
        this.success('✅ School search with query works');
        this.log(`  Search for "university" returned ${searchData.schools.length} results`);
      }

    } catch (error) {
      this.error('School search test failed', error);
    }
  }

  // Test file upload (simulated)
  testFileUpload() {
    this.log('📁 Testing File Upload Validation...');
    
    // Simulate file validation
    const mockFile = {
      name: 'profile.jpg',
      type: 'image/jpeg',
      size: 2 * 1024 * 1024 // 2MB
    };

    // Test file type validation
    if (mockFile.type.startsWith('image/')) {
      this.success('✅ File type validation passed');
    } else {
      this.error('File type validation failed');
    }

    // Test file size validation (5MB limit)
    if (mockFile.size <= 5 * 1024 * 1024) {
      this.success('✅ File size validation passed');
    } else {
      this.error('File size validation failed');
    }

    // Test file name validation
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    const extension = '.' + mockFile.name.split('.').pop().toLowerCase();
    if (allowedExtensions.includes(extension)) {
      this.success('✅ File extension validation passed');
    } else {
      this.error('File extension validation failed');
    }
  }

  // Test registration form submission (simulated)
  async testRegistrationFlow() {
    this.log('🔄 Testing Registration Flow...');
    
    const testData = {
      email: `test.${Date.now()}@example.com`,
      password: 'testpassword123',
      firstName: 'Test',
      lastName: 'Clinician',
      role: 'clinician',
      yearsExperience: 5,
      specialties: ['Tumbling', 'Stunting'],
      city: 'Test City',
      state: 'CA',
      currentSchool: 'Test University',
      bio: 'Test bio for debugging'
    };

    try {
      // Note: This would normally make a real API call
      // For debugging, we're just validating the data structure
      
      this.log('Validating registration data...');
      
      const requiredFields = ['email', 'password', 'firstName', 'lastName', 'yearsExperience', 'specialties', 'city', 'state'];
      const missingFields = requiredFields.filter(field => !testData[field]);
      
      if (missingFields.length === 0) {
        this.success('✅ All required fields present');
      } else {
        this.error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Validate data types
      if (typeof testData.yearsExperience === 'number') {
        this.success('✅ Years experience is a number');
      } else {
        this.error('Years experience must be a number');
      }

      if (Array.isArray(testData.specialties)) {
        this.success('✅ Specialties is an array');
      } else {
        this.error('Specialties must be an array');
      }

    } catch (error) {
      this.error('Registration flow test failed', error);
    }
  }

  // Test coach loading in athlete dashboard
  async testCoachLoading() {
    this.log('👥 Testing Coach Loading...');
    
    try {
      const response = await fetch(`${this.apiBase}/users/clinicians`);
      const data = await response.json();
      
      if (response.ok) {
        this.success(`✅ Coaches loaded successfully: ${data.clinicians.length} coaches`);
        
        // Validate coach data structure
        if (data.clinicians.length > 0) {
          const firstCoach = data.clinicians[0];
          const requiredFields = ['user_id', 'first_name', 'last_name', 'specialties', 'years_experience'];
          const missingFields = requiredFields.filter(field => firstCoach[field] === undefined);
          
          if (missingFields.length === 0) {
            this.success('✅ Coach data structure is valid');
          } else {
            this.error(`Coach missing fields: ${missingFields.join(', ')}`);
          }
        }
      } else {
        this.error(`Coach loading failed: ${response.status}`, data);
      }
    } catch (error) {
      this.error('Coach loading test failed', error);
    }
  }

  // Generate comprehensive report
  generateReport() {
    this.log('📊 Generating Frontend Debug Report...');
    
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

    console.log('\n📊 FRONTEND DEBUG SUMMARY:');
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

    // Save to localStorage for browser debugging
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('frontendDebugReport', JSON.stringify(report));
      this.log('Debug report saved to localStorage');
    }

    return report;
  }

  // Run all tests
  async runAll() {
    console.log('🚀 Starting Frontend Debug Suite...\n');
    
    try {
      this.testFormValidation();
      await this.testAPIEndpoints();
      await this.testDynamicDropdowns();
      await this.testSchoolSearch();
      this.testFileUpload();
      await this.testRegistrationFlow();
      await this.testCoachLoading();
      
      return this.generateReport();
    } catch (error) {
      this.error('Critical error in frontend debug suite', error);
      return this.generateReport();
    }
  }
}

// Browser-compatible export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FrontendDebugger;
} else if (typeof window !== 'undefined') {
  window.FrontendDebugger = FrontendDebugger;
}

// Auto-run if in browser and debug flag is set
if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
  const frontendDebugger = new FrontendDebugger();
  frontendDebugger.runAll().then(report => {
    console.log('Frontend debugging complete!', report);
  });
} 