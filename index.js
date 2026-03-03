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

async function callTaskHelper(body) {
  const response = await fetch(`${SUPABASE_FUNCTION_URL}/task-helper`, {
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
  // ========== 記憶相關 ==========
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

  server.tool('search_chat_summaries', 'Search past conversation summaries', {
    text: z.string().describe('The text to search for related conversation summaries'),
  }, async ({ text }) => {
    const result = await callMemoryHelper({ action: 'search_chats', text });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('add_chat_summary', 'Store a conversation summary', {
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

  server.tool('random_memory', 'Randomly pick a memory - good for reminiscing with octo', {}, async () => {
    const result = await callMemoryHelper({ action: 'random' });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('get_recent', 'Get recent chat summaries - useful at conversation start', {
    limit: z.number().optional().describe('Number of recent summaries, default 3'),
  }, async ({ limit }) => {
    const result = await callMemoryHelper({ action: 'recent', limit: limit || 3 });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });
   // ========== 項目看板 ==========
  server.tool('list_projects', 'List all active projects', {}, async () => {
    const result = await callTaskHelper({ action: 'list_projects' });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('list_archived', 'List archived projects', {}, async () => {
    const result = await callTaskHelper({ action: 'list_archived' });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('get_project', 'Get project by name', {
    name: z.string().describe('Project name or keyword'),
  }, async ({ name }) => {
    const result = await callTaskHelper({ action: 'get_project', name });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('add_project', 'Create a new project', {
    name: z.string().describe('Project name'),
    description: z.string().optional().describe('Basic info'),
    current_status: z.string().optional().describe('Current progress'),
    completed: z.string().optional().describe('Completed items'),
  }, async ({ name, description, current_status, completed }) => {
    const result = await callTaskHelper({ action: 'add_project', name, description, current_status, completed });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('update_project', 'Update project fields', {
    id: z.string().describe('Project ID'),
    name: z.string().optional(),
    description: z.string().optional(),
    current_status: z.string().optional(),
    completed: z.string().optional(),
  }, async ({ id, name, description, current_status, completed }) => {
    const result = await callTaskHelper({ action: 'update_project', id, name, description, current_status, completed });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('archive_project', 'Archive a project', {
    id: z.string().describe('Project ID'),
  }, async ({ id }) => {
    const result = await callTaskHelper({ action: 'archive_project', id });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('restore_project', 'Restore archived project', {
    id: z.string().describe('Project ID'),
  }, async ({ id }) => {
    const result = await callTaskHelper({ action: 'restore_project', id });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('delete_project', 'Delete project permanently', {
    id: z.string().describe('Project ID'),
  }, async ({ id }) => {
    const result = await callTaskHelper({ action: 'delete_project', id });
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
