import express, { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerGa4Tools } from './tools-ga4.js';
import { registerGscTools } from './tools-gsc.js';

// ─── Validate required env vars at startup ────────────────────────────────────

const PORT = process.env.PORT ?? '3000';
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

if (!MCP_AUTH_TOKEN) {
  console.error('ERROR: MCP_AUTH_TOKEN environment variable is required');
  process.exit(1);
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Bearer token auth — applied to all /mcp routes
app.use('/mcp', (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${MCP_AUTH_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

// MCP endpoint — stateless Streamable HTTP (one transport per request)
app.post('/mcp', async (req: Request, res: Response): Promise<void> => {
  try {
    const server = new McpServer({
      name: 'seo-analytics-mcp',
      version: '1.0.0',
    });

    registerGa4Tools(server);
    registerGscTools(server);

    // sessionIdGenerator: undefined = stateless mode (no session state kept server-side)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('MCP request error:', message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Health check — Railway uses this to confirm the service is up
app.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', service: 'seo-analytics-mcp' });
});

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`SEO Analytics MCP server running on port ${PORT}`);
  console.log(`MCP endpoint: POST http://0.0.0.0:${PORT}/mcp`);
  console.log(`Health check: GET  http://0.0.0.0:${PORT}/health`);
});
