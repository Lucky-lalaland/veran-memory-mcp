import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

const SUPABASE_FUNCTION_URL = process.env.SUPABASE_FUNCTION_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function callMemoryHelper(body) {
  const response = await fetch(`${SUPABASE_FUNCTION_URL}/memory-helper`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

const transports = {};

app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;

  const server = new McpServer({
    name: 'veran-memory',
    version: '1.0.0',
  });

  server.tool('search_memory', 'Search memories by semantic similarity', {
    text: z.string().describe('The text to search for related memories'),
  }, async ({ text }) => {
    const result = await callMemoryHelper({ action: 'search', text });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('add_memory', 'Store a new memory about octo', {
    content: z.string().describe('The memory content to store'),
    category: z.string().optional().describe('Category: personal, emotional, event, preference, milestone, relationship, insight'),
    mood: z.string().optional().describe('The emotional mood of this memory'),
    importance: z.number().optional().describe('Importance level 1-5, where 5 is most important'),
    tags: z.array(z.string()).optional().describe('Relevant tags for this memory'),
  }, async ({ content, category, mood, importance, tags }) => {
    const result = await callMemoryHelper({
      action: 'add',
      content,
      category: category || 'general',
      mood,
      importance: importance || 3,
      tags,
      source: 'veran',
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  res.on('close', () => {
    delete transports[transport.sessionId];
  });

  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) {
    return res.status(400).json({ error: 'No active session' });
  }
  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Memory MCP server running on port ${PORT}`);
});