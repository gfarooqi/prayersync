#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PrayerSyncDeployer {
  constructor() {
    this.projectName = 'prayersync';
    this.vercelToken = process.env.VERCEL_TOKEN;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async checkPrerequisites() {
    this.log('Checking deployment prerequisites...');
    
    // Check if Vercel CLI is available
    try {
      execSync('vercel --version', { stdio: 'pipe' });
      this.log('Vercel CLI is available', 'success');
    } catch (error) {
      this.log('Vercel CLI not found. Installing...', 'error');
      execSync('npm install -g vercel', { stdio: 'inherit' });
    }

    // Check required files
    const requiredFiles = ['index.html', 'vercel.json', 'manifest.json'];
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file ${file} not found`);
      }
    }
    this.log('All required files present', 'success');
  }

  async deployToVercel(environment = 'preview') {
    this.log(`Deploying to ${environment}...`);
    
    const deployCmd = environment === 'production' 
      ? 'vercel --prod --yes' 
      : 'vercel --yes';
    
    try {
      const output = execSync(deployCmd, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Extract URL from output
      const urlMatch = output.match(/https:\/\/[^\s]+/);
      const deployUrl = urlMatch ? urlMatch[0] : 'Unknown URL';
      
      this.log(`Deployment successful: ${deployUrl}`, 'success');
      return deployUrl;
    } catch (error) {
      this.log(`Deployment failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async getDeploymentStatus() {
    this.log('Fetching deployment status...');
    try {
      const output = execSync('vercel ls', { encoding: 'utf8' });
      this.log('Current deployments:', 'success');
      console.log(output);
      return output;
    } catch (error) {
      this.log(`Failed to get deployment status: ${error.message}`, 'error');
      throw error;
    }
  }

  async rollback() {
    this.log('Rolling back to previous deployment...');
    try {
      execSync('vercel rollback', { stdio: 'inherit' });
      this.log('Rollback successful', 'success');
    } catch (error) {
      this.log(`Rollback failed: ${error.message}`, 'error');
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const deployer = new PrayerSyncDeployer();
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'deploy':
        await deployer.checkPrerequisites();
        await deployer.deployToVercel('preview');
        break;
      
      case 'deploy-prod':
        await deployer.checkPrerequisites();
        await deployer.deployToVercel('production');
        break;
      
      case 'status':
        await deployer.getDeploymentStatus();
        break;
      
      case 'rollback':
        await deployer.rollback();
        break;
      
      default:
        console.log(`
🚀 PrayerSync Deployment Tool

Usage:
  node deploy.js deploy      - Deploy to preview
  node deploy.js deploy-prod - Deploy to production  
  node deploy.js status      - Check deployment status
  node deploy.js rollback    - Rollback to previous version

Environment Variables:
  VERCEL_TOKEN - Your Vercel API token
        `);
    }
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PrayerSyncDeployer;