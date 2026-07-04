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
  fetchUnprocessedCount,
  updateActivityStatus,
  fetchLatestBriefing,
  fetchLatestKnowledgeBase,
  fetchWeekDensity,
  fetchExtractionRuns,
  updateActivityDelivery,
  openDb,
} from './db.js';
import { runExtraction } from './extraction.js';
import { generateKnowledgeBase, seedKnowledgeBaseIfEmpty } from './knowledge.js';
import { regenerateDraft } from './drafter.js';
import { dispatchDelivery, autoCompleteOverdue } from './delivery.js';

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

openDb();
seedKnowledgeBaseIfEmpty();

// Extraction scheduler
const intervalMin = parseInt(process.env.EXTRACTION_INTERVAL_MINUTES || '15');
setInterval(async () => {
  try {
    console.log('[Scheduler] Auto-extraction started');
    await runExtraction();
  } catch (err: any) {
    console.error('[Scheduler] Error:', err.message);
  }
}, intervalMin * 60 * 1000);

// Daily overdue auto-complete
setInterval(() => {
  try { autoCompleteOverdue(); } catch (err: any) { console.error('[Scheduler] AutoComplete error:', err.message); }
}, 24 * 60 * 60 * 1000);

// --- Activities ---
app.get('/api/activities', (req: Request, res: Response): void => {
  try {
    const { status, urgency, limit = 500 } = req.query;
    const parsedLimit = Math.min(parseInt(String(limit)) || 500, 5000);
    const acts = fetchActivities(
      status ? String(status) : undefined,
      urgency ? String(urgency) : undefined,
      parsedLimit
    );
    res.json({ data: acts, pagination: { total: acts.length, limit: parsedLimit } });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

app.patch('/api/activities/:id', (req: Request, res: Response): void => {
  try {
    const { status } = req.body;
    if (!['pendente', 'concluido', 'descartado'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' }); return;
    }
    updateActivityStatus(parseInt(req.params.id), status);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.patch('/api/activities/:id/delivery', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { delivery_method, delivery_instructions, delivery_draft, action } = req.body;

    if (delivery_method || delivery_instructions || delivery_draft) {
      updateActivityDelivery(id, { delivery_method, delivery_instructions, delivery_draft });
    }

    if (action === 'ignore') {
      updateActivityDelivery(id, { delivery_stage: 'ignored' });
      res.json({ success: true }); return;
    }

    if (action === 'regenerate') {
      const draft = await regenerateDraft(id, delivery_instructions || '');
      res.json({ success: true, draft }); return;
    }

    if (action === 'approve') {
      updateActivityDelivery(id, { delivery_stage: 'delivering' });
      const acts = fetchActivities() as any[];
      const activity = acts.find((a) => a.id === id);
      if (activity) dispatchDelivery(activity).catch(console.error);
      res.json({ success: true }); return;
    }

    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/activities/:id/deliver', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const acts = fetchActivities() as any[];
    const activity = acts.find((a) => a.id === id);
    if (!activity) { res.status(404).json({ error: 'Not found' }); return; }
    dispatchDelivery(activity).catch(console.error);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// --- Messages ---
app.get('/api/messages', (req: Request, res: Response): void => {
  try {
    const { limit = 200, offset = 0, search } = req.query;
    const parsedLimit = Math.min(parseInt(String(limit)) || 200, 1000);
    const parsedOffset = parseInt(String(offset)) || 0;
    const messages = fetchMessages(parsedLimit + parsedOffset, 0, search ? String(search) : undefined);
    res.json({ data: messages.slice(parsedOffset, parsedOffset + parsedLimit), pagination: { total: messages.length, limit: parsedLimit, offset: parsedOffset } });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// --- Briefing ---
app.get('/api/briefing', (req: Request, res: Response): void => {
  try {
    const b = fetchLatestBriefing();
    if (!b) { res.json({ content: 'Nenhum resumo disponível ainda.', minutes_ago: null }); return; }
    const minutesAgo = Math.round((Date.now() - new Date(b.created_at).getTime()) / 60000);
    res.json({ content: b.content, activities_count: b.activities_count, minutes_ago: minutesAgo });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// --- Extractions log ---
app.get('/api/extractions', (req: Request, res: Response): void => {
  try { res.json({ data: fetchExtractionRuns(20) }); }
  catch { res.status(500).json({ error: 'Internal server error' }); }
});

// --- Stats ---
app.get('/api/stats', (req: Request, res: Response): void => {
  try {
    const messageStats = fetchMessageStats();
    const statusCounts = fetchActivityStatusCounts();
    const typeCounts = fetchActivityTypeCounts();
    const usageSummary = fetchUsageSummary();
    const remaining = fetchUnprocessedCount();
    const lastRunAt = usageSummary.last_run_at;
    const lastExtractionMinutesAgo = lastRunAt
      ? Math.round((Date.now() - new Date(lastRunAt).getTime()) / 60000)
      : null;

    res.json({
      total_messages: messageStats.total,
      total_activities: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      messages_processed: messageStats.total - remaining,
      messages_remaining: remaining,
      activities_by_status: { pendente: statusCounts.pendente || 0, concluido: statusCounts.concluido || 0, descartado: statusCounts.descartado || 0 },
      activities_by_type: { prova: typeCounts.prova || 0, trabalho: typeCounts.trabalho || 0, evento: typeCounts.evento || 0, atividade: typeCounts.atividade || 0 },
      token_usage: {
        prompt_tokens: usageSummary.prompt_tokens,
        completion_tokens: usageSummary.completion_tokens,
        total_tokens: usageSummary.prompt_tokens + usageSummary.completion_tokens,
        run_count: usageSummary.run_count,
        last_run_at: lastRunAt,
      },
      last_extraction_minutes_ago: lastExtractionMinutesAgo,
      first_message_timestamp: messageStats.first_timestamp,
      deadline_density: fetchWeekDensity(),
    });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// --- Extract (manual) ---
app.post('/api/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchSize = 30, maxBatches = 10 } = req.body;
    res.json(await runExtraction(batchSize, maxBatches));
  } catch { res.status(500).json({ error: 'Extraction failed' }); }
});

// --- Knowledge base ---
app.post('/api/knowledge/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    await generateKnowledgeBase();
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/health', (_req: Request, res: Response): void => { res.json({ status: 'ok' }); });

app.listen(port, () => {
  console.log(`[Server] Listening on http://localhost:${port}`);
});
