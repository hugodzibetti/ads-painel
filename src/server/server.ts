import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import {
  fetchActivities,
  fetchMessages,
  fetchActivityStatusCounts,
  fetchActivityTypeCounts,
  fetchMessageStats,
  fetchUsageSummary,
  updateActivityStatus,
  openDb,
} from './db.js';
import { runExtraction } from './extraction.js';

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database on startup
openDb();

// Type definitions for API responses
interface ActivityResponse {
  id?: number;
  type: string;
  title: string;
  description?: string;
  due_date: string;
  source_message_id: number;
  status?: string;
  confidence?: string;
  group_label?: string;
  author?: string;
  message_timestamp?: string;
}

interface MessageResponse {
  id?: number;
  wa_message_id: string;
  group_label: string;
  author: string;
  body: string | null;
  timestamp: string;
  processed?: number;
  activity_count?: number;
}

interface StatsResponse {
  total_messages: number;
  total_activities: number;
  messages_processed: number;
  messages_remaining: number;
  activities_by_status: Record<string, number>;
  activities_by_type: Record<string, number>;
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    run_count: number;
    last_run_at: string | null;
  };
  first_message_timestamp: string | null;
}

// GET /api/activities - Fetch activities with optional filters
app.get('/api/activities', (req: Request, res: Response): void => {
  try {
    const { status, limit = 500, offset = 0 } = req.query;
    const parsedLimit = Math.min(parseInt(String(limit)) || 500, 5000);
    const parsedOffset = parseInt(String(offset)) || 0;

    const activities = fetchActivities(
      status ? String(status) : undefined,
      undefined,
      parsedLimit + parsedOffset
    );

    // Apply offset manually
    const paginated = activities.slice(parsedOffset, parsedOffset + parsedLimit);

    res.json({
      data: paginated as ActivityResponse[],
      pagination: {
        total: activities.length,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/messages - Fetch messages with pagination
app.get('/api/messages', (req: Request, res: Response): void => {
  try {
    const { limit = 200, offset = 0, search } = req.query;
    const parsedLimit = Math.min(parseInt(String(limit)) || 200, 1000);
    const parsedOffset = parseInt(String(offset)) || 0;
    const searchQuery = search ? String(search) : undefined;

    const messages = fetchMessages(parsedLimit + parsedOffset, 0, searchQuery);
    const paginated = messages.slice(parsedOffset, parsedOffset + parsedLimit);

    res.json({
      data: paginated as MessageResponse[],
      pagination: {
        total: messages.length,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/extract - Trigger extraction
app.post('/api/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchSize = 30, maxBatches = 10 } = req.body;
    const result = await runExtraction(batchSize, maxBatches);
    res.json(result);
  } catch (error) {
    console.error('Error during extraction:', error);
    res.status(500).json({ error: 'Extraction failed' });
  }
});

// GET /api/stats - System statistics
app.get('/api/stats', (req: Request, res: Response): void => {
  try {
    const messageStats = fetchMessageStats();
    const statusCounts = fetchActivityStatusCounts();
    const typeCounts = fetchActivityTypeCounts();
    const usageSummary = fetchUsageSummary();

    const response: StatsResponse = {
      total_messages: messageStats.total,
      total_activities: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      messages_processed: messageStats.total - fetchUnprocessedCount(),
      messages_remaining: fetchUnprocessedCount(),
      activities_by_status: {
        pendente: statusCounts.pendente || 0,
        concluido: statusCounts.concluido || 0,
        descartado: statusCounts.descartado || 0,
      },
      activities_by_type: {
        prova: typeCounts.prova || 0,
        trabalho: typeCounts.trabalho || 0,
        evento: typeCounts.evento || 0,
        atividade: typeCounts.atividade || 0,
      },
      token_usage: {
        prompt_tokens: usageSummary.prompt_tokens,
        completion_tokens: usageSummary.completion_tokens,
        total_tokens: usageSummary.prompt_tokens + usageSummary.completion_tokens,
        run_count: usageSummary.run_count,
        last_run_at: usageSummary.last_run_at,
      },
      first_message_timestamp: messageStats.first_timestamp,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/activities/:id - Update activity status
app.patch('/api/activities/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pendente', 'concluido', 'descartado'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    updateActivityStatus(parseInt(id), status);
    res.json({ success: true, id: parseInt(id), status });
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response): void => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any): void => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`[Server] Listening on http://localhost:${port}`);
  console.log(`[Server] API endpoints:`);
  console.log(`  GET    /api/activities - Fetch activities`);
  console.log(`  GET    /api/messages - Fetch messages`);
  console.log(`  POST   /api/extract - Trigger extraction`);
  console.log(`  GET    /api/stats - System statistics`);
  console.log(`  PATCH  /api/activities/:id - Update activity status`);
  console.log(`  GET    /health - Health check`);
});

// Import missing function
import { fetchUnprocessedCount } from './db.js';
