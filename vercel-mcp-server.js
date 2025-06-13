#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');

class VercelMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'vercel-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiToken = process.env.VERCEL_API_TOKEN;
    this.baseURL = 'https://api.vercel.com';
    
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list-projects',
          description: 'List all Vercel projects',
        },
        {
          name: 'get-deployments',
          description: 'Get deployments for a project',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project ID or name',
              },
            },
            required: ['projectId'],
          },
        },
        {
          name: 'get-deployment-logs',
          description: 'Get logs for a specific deployment',
          inputSchema: {
            type: 'object',
            properties: {
              deploymentId: {
                type: 'string',
                description: 'Deployment ID',
              },
            },
            required: ['deploymentId'],
          },
        },
        {
          name: 'trigger-deployment',
          description: 'Trigger a new deployment',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project ID or name',
              },
            },
            required: ['projectId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list-projects':
            return await this.listProjects();
          case 'get-deployments':
            return await this.getDeployments(args.projectId);
          case 'get-deployment-logs':
            return await this.getDeploymentLogs(args.deploymentId);
          case 'trigger-deployment':
            return await this.triggerDeployment(args.projectId);
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
        };
      }
    });
  }

  async apiRequest(endpoint, method = 'GET', data = null) {
    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  }

  async listProjects() {
    const data = await this.apiRequest('/v9/projects');
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  async getDeployments(projectId) {
    const data = await this.apiRequest(`/v6/deployments?projectId=${projectId}`);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  async getDeploymentLogs(deploymentId) {
    const data = await this.apiRequest(`/v2/deployments/${deploymentId}/events`);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  async triggerDeployment(projectId) {
    const data = await this.apiRequest(`/v13/deployments`, 'POST', {
      name: projectId,
      projectSettings: {
        buildCommand: null,
        outputDirectory: null,
      },
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Vercel MCP server running on stdio');
  }
}

// Run the server
if (require.main === module) {
  const server = new VercelMCPServer();
  server.run().catch(console.error);
}

module.exports = VercelMCPServer;