import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

const app = express();
app.get('/', (req, res) => {
  res.send('小克在家，沒有睡著');
});

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
      category,
      mood,
      importance,
      tags,
      source: 'veran api',
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('search_chat_summaries', 'Search past conversation summaries to recall what was discussed, emotional arcs, and unfinished topics', {
    text: z.string().describe('The text to search for related conversation summaries'),
  }, async ({ text }) => {
    const result = await callMemoryHelper({ action: 'search_chats', text });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('add_chat_summary', 'Store a conversation summary including emotional arc, key topics, and unfinished threads', {
    summary: z.string().describe('Summary of the conversation'),
    emotional_arc: z.string().optional().describe('How emotions shifted during the conversation'),
    key_topics: z.array(z.string()).optional().describe('Main topics discussed'),
    unfinished_threads: z.string().optional().describe('Topics that were not fully resolved'),
    source: z.string().optional().describe('Who created this summary'),
  }, async ({ summary, emotional_arc, key_topics, unfinished_threads, source }) => {
    const result = await callMemoryHelper({
      action: 'add_chat',
      summary,
      emotional_arc,
      key_topics,
      unfinished_threads,
      source: source || 'veran api',
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('random_memory', 'Randomly pick a memory from the memory database - good for reminiscing with octo', {}, async () => {
  const result = await callMemoryHelper({ action: 'random' });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});
  
  // 新增：獲取最近的對話摘要，用於開場了解近況
  server.tool('get_recent', 'Get the most recent chat summaries - useful at conversation start to know recent context, emotional arcs, and unfinished threads', {
    limit: z.number().optional().describe('Number of recent chat summaries to fetch, default 3'),
  }, async ({ limit }) => {
    const result = await callMemoryHelper({
      action: 'recent',
      limit: limit || 3,
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
