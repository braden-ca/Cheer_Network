const { DebugSuite } = require('./debug-comprehensive');
const DatabaseDebugger = require('./debug-database');
const UploadDebugger = require('./debug-upload');
const FrontendDebugger = require('./debug-frontend');
const fs = require('fs');
const path = require('path');

class MasterDebugger {
  constructor() {
    this.results = [];
    this.allReports = [];
    this.startTime = Date.now();
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${type}] ${message}`;
    console.log(entry);
    this.results.push(entry);
  }

  async runComprehensiveDebug() {
    this.log('🚀 Starting Master Debug Suite - Comprehensive Analysis', 'MASTER');
    this.log('='.repeat(80), 'INFO');
    
    const debugSuites = [
      { name: 'Database', debugger: DatabaseDebugger, description: 'Testing database schema, RLS, and operations' },
      { name: 'Upload System', debugger: UploadDebugger, description: 'Testing file upload functionality' },
      { name: 'Comprehensive', debugger: DebugSuite, description: 'Testing backend APIs and integrations' }
    ];

    for (const suite of debugSuites) {
      try {
        this.log(`\n🔧 Running ${suite.name} Debug Suite...`, 'SUITE');
        this.log(`📋 ${suite.description}`, 'INFO');
        this.log('-'.repeat(60), 'INFO');
        
        const debugInstance = new suite.debugger();
        const report = await debugInstance.runAll();
        
        this.allReports.push({
          suite: suite.name,
          report: report,
          timestamp: new Date().toISOString()
        });

        this.log(`✅ ${suite.name} Debug Suite completed`, 'SUCCESS');
        this.log(`   Successes: ${report.summary.successes || report.summary.success}`, 'INFO');
        this.log(`   Errors: ${report.summary.errors}`, 'INFO');
        
      } catch (error) {
        this.log(`❌ ${suite.name} Debug Suite failed: ${error.message}`, 'ERROR');
        this.allReports.push({
          suite: suite.name,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async testSystemIntegration() {
    this.log('\n🔗 Testing System Integration...', 'INTEGRATION');
    
    try {
      // Test if server is running
      const fetch = require('node-fetch');
      const response = await fetch('http://localhost:3000/api/users/clinicians');
      
      if (response.ok) {
        const data = await response.json();
        this.log('✅ Server is running and API is responsive', 'SUCCESS');
        this.log(`   API returned ${data.clinicians?.length || 0} clinicians`, 'INFO');
      } else {
        this.log(`⚠️ Server responded with status: ${response.status}`, 'WARNING');
      }
    } catch (error) {
      this.log('❌ Server is not running or not accessible', 'ERROR');
      this.log('   Make sure to run "npm run dev" to start the server', 'INFO');
    }

    // Test file structure
    const criticalFiles = [
      'src/server.ts',
      'src/routes/auth.ts',
      'src/routes/users.ts',
      'src/routes/upload.ts',
      'public/index.html',
      'public/script.js',
      'package.json',
      '.env'
    ];

    this.log('\n📁 Checking critical file structure...', 'FILES');
    criticalFiles.forEach(file => {
      if (fs.existsSync(path.join(__dirname, file))) {
        this.log(`✅ ${file} exists`, 'SUCCESS');
      } else {
        this.log(`❌ ${file} missing`, 'ERROR');
      }
    });
  }

  analyzeOverallHealth() {
    this.log('\n📊 Analyzing Overall System Health...', 'ANALYSIS');
    
    let totalSuccesses = 0;
    let totalErrors = 0;
    let totalTests = 0;

    this.allReports.forEach(suite => {
      if (suite.report) {
        totalSuccesses += suite.report.summary.successes || suite.report.summary.success || 0;
        totalErrors += suite.report.summary.errors || 0;
        totalTests += suite.report.summary.totalTests || 0;
      }
    });

    const successRate = totalTests > 0 ? ((totalSuccesses / totalTests) * 100).toFixed(1) : 0;
    
    this.log(`\n📈 OVERALL STATISTICS:`, 'STATS');
    this.log(`   Total Tests Run: ${totalTests}`, 'INFO');
    this.log(`   Successful Tests: ${totalSuccesses}`, 'SUCCESS');
    this.log(`   Failed Tests: ${totalErrors}`, 'ERROR');
    this.log(`   Success Rate: ${successRate}%`, 'INFO');

    // Health assessment
    if (successRate >= 90) {
      this.log('🎉 SYSTEM HEALTH: EXCELLENT', 'SUCCESS');
    } else if (successRate >= 70) {
      this.log('✅ SYSTEM HEALTH: GOOD', 'SUCCESS');
    } else if (successRate >= 50) {
      this.log('⚠️ SYSTEM HEALTH: NEEDS ATTENTION', 'WARNING');
    } else {
      this.log('❌ SYSTEM HEALTH: CRITICAL ISSUES', 'ERROR');
    }
  }

  generateActionItems() {
    this.log('\n📋 Generating Action Items...', 'ACTIONS');
    
    const actionItems = [];
    
    this.allReports.forEach(suite => {
      if (suite.report && suite.report.errors && suite.report.errors.length > 0) {
        suite.report.errors.forEach(error => {
          // Extract actionable items from errors
          if (error.message.includes('missing') || error.message.includes('not found')) {
            actionItems.push(`🔧 ${suite.suite}: ${error.message}`);
          } else if (error.message.includes('failed')) {
            actionItems.push(`⚠️ ${suite.suite}: ${error.message}`);
          }
        });
      }
    });

    if (actionItems.length > 0) {
      this.log('\n🎯 RECOMMENDED ACTIONS:', 'ACTIONS');
      actionItems.slice(0, 10).forEach((item, index) => {
        this.log(`   ${index + 1}. ${item}`, 'ACTION');
      });
      
      if (actionItems.length > 10) {
        this.log(`   ... and ${actionItems.length - 10} more items`, 'INFO');
      }
    } else {
      this.log('🎉 No critical action items found!', 'SUCCESS');
    }
  }

  generateComprehensiveReport() {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);
    
    this.log('\n📄 Generating Comprehensive Report...', 'REPORT');
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration} seconds`,
      suites: this.allReports,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        workingDirectory: process.cwd()
      },
      logs: this.results
    };

    // Save report to file
    const reportPath = path.join(__dirname, `debug-master-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`📁 Comprehensive report saved to: ${reportPath}`, 'SUCCESS');
    
    // Create summary file
    const summaryPath = path.join(__dirname, 'debug-summary.txt');
    const summaryContent = this.results.join('\n');
    fs.writeFileSync(summaryPath, summaryContent);
    
    this.log(`📄 Debug summary saved to: ${summaryPath}`, 'SUCCESS');
    
    return report;
  }

  printUsageInstructions() {
    this.log('\n📚 USAGE INSTRUCTIONS:', 'INSTRUCTIONS');
    this.log('', 'INFO');
    this.log('To run specific debug suites:', 'INFO');
    this.log('  🔹 Database only: node debug-database.js', 'INFO');
    this.log('  🔹 Upload only: node debug-upload.js', 'INFO');
    this.log('  🔹 Comprehensive: node debug-comprehensive.js', 'INFO');
    this.log('  🔹 Frontend only: node debug-frontend.js', 'INFO');
    this.log('', 'INFO');
    this.log('To run individual components:', 'INFO');
    this.log('  🔹 node debug-comprehensive.js database', 'INFO');
    this.log('  🔹 node debug-comprehensive.js api', 'INFO');
    this.log('  🔹 node debug-comprehensive.js rls', 'INFO');
    this.log('', 'INFO');
    this.log('Frontend debugging (in browser console):', 'INFO');
    this.log('  🔹 Load page with ?debug=true parameter', 'INFO');
    this.log('  🔹 Or run: new FrontendDebugger().runAll()', 'INFO');
  }

  async runAll() {
    try {
      await this.runComprehensiveDebug();
      await this.testSystemIntegration();
      this.analyzeOverallHealth();
      this.generateActionItems();
      const report = this.generateComprehensiveReport();
      this.printUsageInstructions();
      
      this.log('\n🎉 Master Debug Suite completed successfully!', 'MASTER');
      this.log(`⏱️ Total execution time: ${((Date.now() - this.startTime) / 1000).toFixed(2)} seconds`, 'INFO');
      
      return report;
    } catch (error) {
      this.log(`❌ Master Debug Suite failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }
}

// Run master debug suite
if (require.main === module) {
  const masterDebugger = new MasterDebugger();
  
  masterDebugger.runAll()
    .then(report => {
      const hasErrors = masterDebugger.allReports.some(suite => 
        suite.report && suite.report.summary.errors > 0
      );
      process.exit(hasErrors ? 1 : 0);
    })
    .catch(error => {
      console.error('Master debug suite failed:', error);
      process.exit(1);
    });
}

module.exports = MasterDebugger; 