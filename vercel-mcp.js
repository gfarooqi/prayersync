#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import fs from 'fs';

class VercelMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'vercel-deployment-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'deploy_project',
            description: 'Deploy the PrayerSync project to Vercel',
            inputSchema: {
              type: 'object',
              properties: {
                environment: {
                  type: 'string',
                  enum: ['production', 'preview'],
                  default: 'preview',
                  description: 'Deployment environment'
                },
                force: {
                  type: 'boolean',
                  default: false,
                  description: 'Force deployment'
                }
              },
            },
          },
          {
            name: 'check_deployment_status',
            description: 'Check current deployment status',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_deployment_logs',
            description: 'Get recent deployment logs',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  default: 10,
                  description: 'Number of log entries to retrieve'
                }
              },
            },
          },
          {
            name: 'rollback_deployment',
            description: 'Rollback to previous deployment',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          }
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'deploy_project':
            return await this.deployProject(args);
          case 'check_deployment_status':
            return await this.checkDeploymentStatus();
          case 'get_deployment_logs':
            return await this.getDeploymentLogs(args?.limit || 10);
          case 'rollback_deployment':
            return await this.rollbackDeployment();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async deployProject(args) {
    const { environment = 'preview', force = false } = args || {};
    
    try {
      // Check if vercel is installed
      execSync('vercel --version', { stdio: 'pipe' });
      
      const deployCmd = environment === 'production' 
        ? 'vercel --prod --yes' 
        : 'vercel --yes';
      
      const output = execSync(deployCmd, { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      // Extract URL from output
      const urlMatch = output.match(/https:\/\/[^\s]+/);
      const deployUrl = urlMatch ? urlMatch[0] : 'Deployment completed';
      
      return {
        content: [
          {
            type: 'text',
            text: `🚀 Successfully deployed PrayerSync to ${environment}!\n\nURL: ${deployUrl}\n\nOutput:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Deployment failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async checkDeploymentStatus() {
    try {
      const output = execSync('vercel ls', { encoding: 'utf8' });
      return {
        content: [
          {
            type: 'text',
            text: `📊 Current deployments:\n\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to get deployment status: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getDeploymentLogs(limit) {
    try {
      const output = execSync(`vercel logs --limit ${limit}`, { encoding: 'utf8' });
      return {
        content: [
          {
            type: 'text',
            text: `📋 Recent deployment logs (last ${limit}):\n\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to get logs: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async rollbackDeployment() {
    try {
      const output = execSync('vercel rollback', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return {
        content: [
          {
            type: 'text',
            text: `↩️ Rollback completed:\n\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Rollback failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Vercel MCP server running on stdio');
  }
}

const server = new VercelMCPServer();
server.run().catch(console.error);