import { randomUUID } from 'node:crypto';
import {
  fetchUnprocessedMessages,
  fetchUnprocessedCount,
  markBatchProcessed,
  insertActivities,
  checkDuplicateActivity,
  insertLLMUsage,
  updateActivityDelivery,
  Message,
  Activity,
} from './db.js';
import { getSystemPrompt, buildUserPrompt } from './prompts.js';
import { chat, getModel } from './llm.js';
import { classifyAndDetect } from './deliveryDetector.js';
import { generateBriefing } from './briefing.js';
import { scanNewMessages } from './contextMonitor.js';
import { checkAndDraftSubmissions } from './drafter.js';

function normalizeTitle(title: string): string {
  return title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractJsonFromResponse(text: string): any {
  let match = text.match(/```(?:json)?\s*(.*?)\s*```/s);
  if (match) text = match[1].trim();
  try { return JSON.parse(text); } catch {
    match = text.match(/\{.*\}/s);
    if (match) try { return JSON.parse(match[0]); } catch { return null; }
  }
  return null;
}

export interface ExtractionResult {
  run_id: string;
  total_tokens_used: number;
  activities_extracted: number;
  messages_processed: number;
  messages_remaining: number;
  errors: string[];
}

export async function runExtraction(batchSize = 30, maxBatches = 10): Promise<ExtractionResult> {
  if (!process.env.OPENCODE_API_KEY) {
    return { run_id: '', total_tokens_used: 0, activities_extracted: 0, messages_processed: 0, messages_remaining: 0, errors: ['OPENCODE_API_KEY is not set'] };
  }

  const runId = randomUUID();
  const model = getModel();
  let totalTokens = 0, totalActivities = 0, totalProcessed = 0;
  const errors: string[] = [];
  const allNewActivityIds: number[] = [];
  const allProcessedMessages: Message[] = [];

  for (let batchNum = 0; batchNum < maxBatches; batchNum++) {
    const messages = fetchUnprocessedMessages(batchSize);
    if (messages.length === 0) break;
    const messageIds = messages.map((m) => m.id!);

    try {
      const { content, promptTokens, completionTokens } = await chat(
        getSystemPrompt(),
        buildUserPrompt(messages),
        { temperature: 0.3 }
      );

      totalTokens += promptTokens + completionTokens;
      insertLLMUsage(model, promptTokens, completionTokens, messageIds.length, runId);

      const data = extractJsonFromResponse(content);
      if (!data || !Array.isArray(data.items)) {
        console.warn(`[Extraction] Batch ${batchNum + 1}: invalid JSON, marking processed`);
        markBatchProcessed(messageIds);
        totalProcessed += messageIds.length;
        allProcessedMessages.push(...messages);
        continue;
      }

      const validItems: Activity[] = [];
      for (const item of data.items) {
        if (!item.type || !item.title || !item.due_date || item.source_message_id === undefined) continue;
        if (!messageIds.includes(item.source_message_id)) continue;
        if (!['prova', 'trabalho', 'evento', 'atividade'].includes(item.type)) continue;
        if (!['alta', 'media', 'baixa'].includes(item.confidence)) item.confidence = 'media';
        if (!item.due_date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
        validItems.push(item);
      }

      const dedupedItems: Activity[] = [];
      for (const item of validItems) {
        if (!checkDuplicateActivity(item.type, normalizeTitle(item.title), item.due_date)) {
          dedupedItems.push(item);
        }
      }

      if (dedupedItems.length > 0) {
        const newIds = insertActivities(dedupedItems) ?? [];
        totalActivities += dedupedItems.length;
        allNewActivityIds.push(...newIds);
      }

      markBatchProcessed(messageIds);
      totalProcessed += messageIds.length;
      allProcessedMessages.push(...messages);
    } catch (err: any) {
      const errorMsg = `Batch ${batchNum + 1} extraction error: ${err.message || String(err)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  // Post-run pipeline: classify new activities
  if (allNewActivityIds.length > 0) {
    const { fetchActivities } = await import('./db.js');
    for (const activityId of allNewActivityIds) {
      try {
        const activities = fetchActivities() as any[];
        const activity = activities.find((a) => a.id === activityId);
        if (!activity) continue;
        const sourceMsg = allProcessedMessages.find((m) => m.id === activity.source_message_id);
        const result = await classifyAndDetect(activity, sourceMsg ? [sourceMsg] : []);
        const nextStage = !result.is_graded ? 'ignored' : result.delivery_method === 'unknown' ? 'needs_method' : 'gathering';
        updateActivityDelivery(activityId, {
          is_graded: result.is_graded ? 1 : 0,
          delivery_method: result.delivery_method,
          delivery_url: result.delivery_url ?? undefined,
          delivery_instructions: result.delivery_instructions ?? undefined,
          delivery_stage: nextStage,
        } as any);
      } catch (err: any) {
        console.error(`[Extraction] Detector failed for activity ${activityId}:`, err.message);
      }
    }
  }

  if (allProcessedMessages.length > 0) {
    try { await scanNewMessages(allProcessedMessages); } catch (err: any) { console.error('[Extraction] ContextMonitor error:', err.message); }
  }

  try { await generateBriefing(); } catch (err: any) { console.error('[Extraction] Briefing error:', err.message); }
  try { await checkAndDraftSubmissions(); } catch (err: any) { console.error('[Extraction] Drafter error:', err.message); }

  return {
    run_id: runId,
    total_tokens_used: totalTokens,
    activities_extracted: totalActivities,
    messages_processed: totalProcessed,
    messages_remaining: fetchUnprocessedCount(),
    errors,
  };
}
