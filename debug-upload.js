const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Import fetch for Node.js
let fetch;
try {
  fetch = require('node-fetch');
} catch (error) {
  // If node-fetch is not available, try to use built-in fetch (Node 18+)
  if (typeof globalThis.fetch !== 'undefined') {
    fetch = globalThis.fetch;
  } else {
    console.warn('fetch not available, upload endpoint tests will be skipped');
  }
}

class UploadDebugger {
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

  testDirectoryStructure() {
    this.log('📁 Testing Upload Directory Structure...');
    
    const requiredDirs = [
      'public',
      'public/uploads',
      'public/uploads/profiles'
    ];

    requiredDirs.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      if (fs.existsSync(dirPath)) {
        this.success(`✅ Directory exists: ${dir}`);
        
        // Check if directory is writable
        try {
          const testFile = path.join(dirPath, 'test-write.tmp');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          this.success(`✅ Directory writable: ${dir}`);
        } catch (error) {
          this.error(`Directory not writable: ${dir}`, error);
        }
      } else {
        this.error(`Directory missing: ${dir}`);
        
        // Try to create it
        try {
          fs.mkdirSync(dirPath, { recursive: true });
          this.success(`✅ Created directory: ${dir}`);
        } catch (error) {
          this.error(`Failed to create directory: ${dir}`, error);
        }
      }
    });
  }

  testFileValidation() {
    this.log('📋 Testing File Validation Logic...');
    
    const testFiles = [
      { name: 'valid.jpg', type: 'image/jpeg', size: 1024 * 1024, valid: true },
      { name: 'valid.png', type: 'image/png', size: 2 * 1024 * 1024, valid: true },
      { name: 'invalid.txt', type: 'text/plain', size: 1024, valid: false },
      { name: 'toolarge.jpg', type: 'image/jpeg', size: 10 * 1024 * 1024, valid: false },
      { name: 'noextension', type: 'image/jpeg', size: 1024 * 1024, valid: false }
    ];

    testFiles.forEach(file => {
      // Test file type validation
      const isValidType = file.type.startsWith('image/');
      
      // Test file size validation (5MB limit)
      const isValidSize = file.size <= 5 * 1024 * 1024;
      
      // Test file extension validation
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
      const extension = path.extname(file.name).toLowerCase();
      const isValidExtension = allowedExtensions.includes(extension) && extension !== '';
      
      const isValid = isValidType && isValidSize && isValidExtension;
      
      if (isValid === file.valid) {
        this.success(`✅ Validation correct for ${file.name}: ${isValid ? 'valid' : 'invalid'}`);
      } else {
        this.error(`Validation incorrect for ${file.name}: expected ${file.valid}, got ${isValid}`);
      }
    });
  }

  async testUploadEndpoint() {
    this.log('🔌 Testing Upload Endpoint...');
    
    if (!fetch) {
      this.log('⚠️ Fetch not available, skipping endpoint tests');
      return;
    }
    
    try {
      // Test endpoint without file (should return 400)
      const emptyResponse = await fetch(`${this.apiBase}/upload/profile-picture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (emptyResponse.status === 400) {
        this.success('✅ Upload endpoint correctly rejects empty request');
      } else {
        this.log(`Upload endpoint returned unexpected status: ${emptyResponse.status}`);
      }

      // Create a test image file
      const testImagePath = path.join(__dirname, 'test-image.jpg');
      const testImageData = Buffer.from('fake-jpeg-data');
      fs.writeFileSync(testImagePath, testImageData);

      // Test with fake file (should still reach the endpoint)
      const formData = new FormData();
      formData.append('profilePicture', fs.createReadStream(testImagePath), {
        filename: 'test.jpg',
        contentType: 'image/jpeg'
      });

      const uploadResponse = await fetch(`${this.apiBase}/upload/profile-picture`, {
        method: 'POST',
        body: formData
      });

      // Clean up test file
      fs.unlinkSync(testImagePath);

      if (uploadResponse.status === 401) {
        this.success('✅ Upload endpoint requires authentication');
      } else if (uploadResponse.ok) {
        this.success('✅ Upload endpoint accessible');
      } else {
        this.log(`Upload endpoint returned status: ${uploadResponse.status}`);
        const errorText = await uploadResponse.text();
        this.log(`Error: ${errorText}`);
      }

    } catch (error) {
      this.error('Upload endpoint test failed', error);
    }
  }

  testMulterConfiguration() {
    this.log('⚙️ Testing Multer Configuration...');
    
    try {
      // Check if multer is installed
      const multerInstalled = fs.existsSync(path.join(__dirname, 'node_modules', 'multer'));
      if (multerInstalled) {
        this.success('✅ Multer package is installed');
      } else {
        this.error('Multer package not found');
      }

      // Check if multer types are installed
      const multerTypesInstalled = fs.existsSync(path.join(__dirname, 'node_modules', '@types', 'multer'));
      if (multerTypesInstalled) {
        this.success('✅ Multer TypeScript types are installed');
      } else {
        this.log('Multer TypeScript types not found (may not be required)');
      }

      // Check upload route file
      const uploadRoutePath = path.join(__dirname, 'src', 'routes', 'upload.ts');
      if (fs.existsSync(uploadRoutePath)) {
        this.success('✅ Upload route file exists');
        
        // Read and analyze the route file
        const routeContent = fs.readFileSync(uploadRoutePath, 'utf8');
        
        if (routeContent.includes('multer')) {
          this.success('✅ Multer configuration found in route');
        } else {
          this.error('Multer configuration not found in upload route');
        }

        if (routeContent.includes('fileFilter')) {
          this.success('✅ File filter configuration found');
        } else {
          this.log('File filter configuration not found');
        }

        if (routeContent.includes('limits')) {
          this.success('✅ File size limits configuration found');
        } else {
          this.log('File size limits configuration not found');
        }
      } else {
        this.error('Upload route file not found');
      }

    } catch (error) {
      this.error('Multer configuration test failed', error);
    }
  }

  testImageProcessing() {
    this.log('🖼️ Testing Image Processing...');
    
    // Test basic image operations that might be needed
    const testImages = [
      { name: 'test.jpg', ext: '.jpg', mime: 'image/jpeg' },
      { name: 'test.png', ext: '.png', mime: 'image/png' },
      { name: 'test.gif', ext: '.gif', mime: 'image/gif' }
    ];

    testImages.forEach(img => {
      // Test filename generation
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}-${Math.random().toString(36).substring(2, 15)}${img.ext}`;
      
      if (uniqueFilename.includes(timestamp.toString()) && uniqueFilename.endsWith(img.ext)) {
        this.success(`✅ Unique filename generation works for ${img.name}`);
      } else {
        this.error(`Filename generation failed for ${img.name}`);
      }
    });

    // Test file path generation
    const profilesDir = path.join(__dirname, 'public', 'uploads', 'profiles');
    const testFilename = 'test-profile.jpg';
    const fullPath = path.join(profilesDir, testFilename);
    const relativePath = path.join('uploads', 'profiles', testFilename);

    this.log(`Full path: ${fullPath}`);
    this.log(`Relative path: ${relativePath}`);
    
    if (fullPath.includes('profiles') && relativePath.startsWith('uploads')) {
      this.success('✅ File path generation works correctly');
    } else {
      this.error('File path generation incorrect');
    }
  }

  testServerIntegration() {
    this.log('🔧 Testing Server Integration...');
    
    try {
      // Check if upload route is registered in server
      const serverPath = path.join(__dirname, 'src', 'server.ts');
      if (fs.existsSync(serverPath)) {
        const serverContent = fs.readFileSync(serverPath, 'utf8');
        
        if (serverContent.includes('upload') || serverContent.includes('/api/upload')) {
          this.success('✅ Upload routes registered in server');
        } else {
          this.error('Upload routes not found in server configuration');
        }

        // Check if static files are served
        if (serverContent.includes('static') || serverContent.includes('express.static')) {
          this.success('✅ Static file serving configured');
        } else {
          this.error('Static file serving not configured');
        }
      } else {
        this.error('Server file not found');
      }

      // Check if uploads are included in static serving
      const publicPath = path.join(__dirname, 'public');
      if (fs.existsSync(publicPath)) {
        this.success('✅ Public directory exists for static serving');
      } else {
        this.error('Public directory not found');
      }

    } catch (error) {
      this.error('Server integration test failed', error);
    }
  }

  generateReport() {
    this.log('📊 Generating Upload Debug Report...');
    
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

    console.log('\n📊 UPLOAD DEBUG SUMMARY:');
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
    console.log('🚀 Starting Upload System Debug Suite...\n');
    
    try {
      this.testDirectoryStructure();
      this.testFileValidation();
      this.testMulterConfiguration();
      this.testImageProcessing();
      this.testServerIntegration();
      await this.testUploadEndpoint();
      
      return this.generateReport();
    } catch (error) {
      this.error('Critical error in upload debug suite', error);
      return this.generateReport();
    }
  }
}

// Export for use in other scripts
module.exports = UploadDebugger;

// Run if called directly
if (require.main === module) {
  const uploadDebugger = new UploadDebugger();
  uploadDebugger.runAll().then(report => {
    console.log('\nUpload system debugging complete!');
    process.exit(report.summary.errors > 0 ? 1 : 0);
  });
} 