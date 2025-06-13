import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const handler = createMcpHandler(
  (server) => {
    // Deploy project tool
    server.tool(
      'deploy_project',
      'Deploy the PrayerSync project to Vercel',
      { 
        environment: z.enum(['production', 'preview']).default('preview'),
        force: z.boolean().default(false)
      },
      async ({ environment, force }) => {
        return {
          content: [{ 
            type: 'text', 
            text: `🚀 Deploying PrayerSync to ${environment} environment${force ? ' (forced)' : ''}...` 
          }],
        };
      },
    );

    // Check deployment status
    server.tool(
      'check_deployment',
      'Check the current deployment status of PrayerSync',
      {},
      async () => {
        return {
          content: [{ 
            type: 'text', 
            text: `📊 Checking deployment status for PrayerSync...` 
          }],
        };
      },
    );

    // Get deployment logs
    server.tool(
      'get_deployment_logs',
      'Get deployment logs for debugging',
      { 
        limit: z.number().int().min(1).max(100).default(50) 
      },
      async ({ limit }) => {
        return {
          content: [{ 
            type: 'text', 
            text: `📋 Fetching last ${limit} deployment logs...` 
          }],
        };
      },
    );

    // Update environment variables
    server.tool(
      'update_env_vars',
      'Update environment variables for the deployment',
      { 
        key: z.string(),
        value: z.string(),
        target: z.enum(['production', 'preview', 'development']).default('production')
      },
      async ({ key, value, target }) => {
        return {
          content: [{ 
            type: 'text', 
            text: `🔧 Setting environment variable ${key} for ${target} environment` 
          }],
        };
      },
    );
  },
  {},
  { basePath: '/api' },
);

export { handler as GET, handler as POST, handler as DELETE };