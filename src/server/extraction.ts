import OpenAI from 'openai';
import {
  fetchUnprocessedMessages,
  fetchUnprocessedCount,
  markBatchProcessed,
  insertActivities,
  checkDuplicateActivity,
  insertLLMUsage,
  Message,
  Activity,
} from './db.js';
import { getSystemPrompt, buildUserPrompt } from './prompts.js';

function normalizeTitle(title: string): string {
  title = title.toLowerCase();
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function extractJsonFromResponse(text: string): any {
  // Try to find JSON block wrapped in markdown code fence
  let match = text.match(/```(?:json)?\s*(.*?)\s*```/s);
  if (match) {
    text = match[1].trim();
  }

  // Try to parse as JSON
  try {
    return JSON.parse(text);
  } catch (err) {
    // Try to find JSON object pattern
    match = text.match(/\{.*\}/s);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (err2) {
        return null;
      }
    }
  }
  return null;
}

interface ExtractionResult {
  total_tokens_used: number;
  activities_extracted: number;
  messages_processed: number;
  messages_remaining: number;
  errors: string[];
}

export async function runExtraction(
  batchSize: number = 30,
  maxBatches: number = 10
): Promise<ExtractionResult> {
  const apiKey = process.env.OPENCODE_API_KEY;
  const baseUrl = process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1';
  const model = process.env.OPENCODE_MODEL || 'deepseek-v4-flash';

  if (!apiKey) {
    return {
      total_tokens_used: 0,
      activities_extracted: 0,
      messages_processed: 0,
      messages_remaining: 0,
      errors: ['OPENCODE_API_KEY is not set'],
    };
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });

  const systemPrompt = getSystemPrompt();
  let totalTokens = 0;
  let totalActivities = 0;
  let totalMessagesProcessed = 0;
  const errors: string[] = [];

  for (let batchNum = 0; batchNum < maxBatches; batchNum++) {
    const messages = fetchUnprocessedMessages(batchSize);
    if (messages.length === 0) {
      break;
    }

    const messageIds = messages.map((msg) => msg.id!);

    try {
      const userPrompt = buildUserPrompt(messages);

      const response = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      });

      totalTokens += (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);
      insertLLMUsage(
        model,
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0,
        messageIds.length
      );

      const responseText = response.choices[0]?.message?.content || '';

      const data = extractJsonFromResponse(responseText);
      if (!data || !Array.isArray(data.items)) {
        console.warn(`Batch ${batchNum + 1}: Invalid JSON response, marking as processed anyway`);
        markBatchProcessed(messageIds);
        totalMessagesProcessed += messageIds.length;
        continue;
      }

      const items = data.items || [];
      const validItems: Activity[] = [];

      for (const item of items) {
        // Validate required fields
        if (!item.type || !item.title || !item.due_date || item.source_message_id === undefined) {
          console.warn(`Item missing required fields: ${JSON.stringify(item)}`);
          continue;
        }

        // Validate source_message_id
        const sourceId = item.source_message_id;
        if (!Number.isInteger(sourceId) || !messageIds.includes(sourceId)) {
          console.warn(`Item source_message_id ${sourceId} not in batch, discarding`);
          continue;
        }

        // Validate type
        if (!['prova', 'trabalho', 'evento', 'atividade'].includes(item.type)) {
          console.warn(`Invalid type: ${item.type}`);
          continue;
        }

        // Validate confidence
        if (!['alta', 'media', 'baixa'].includes(item.confidence)) {
          item.confidence = 'media';
        }

        // Validate due_date format (ISO)
        try {
          new Date(item.due_date);
          if (!item.due_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            throw new Error('Invalid ISO date format');
          }
        } catch (err) {
          console.warn(`Invalid due_date format: ${item.due_date}`);
          continue;
        }

        validItems.push(item);
      }

      // Dedup: check for similar existing activities
      const dedupedItems: Activity[] = [];
      for (const item of validItems) {
        const titleNorm = normalizeTitle(item.title);
        if (checkDuplicateActivity(item.type, titleNorm, item.due_date)) {
          console.info(`Duplicate activity skipped: ${item.title}`);
          continue;
        }
        dedupedItems.push(item);
      }

      // Insert valid items
      if (dedupedItems.length > 0) {
        insertActivities(dedupedItems);
        totalActivities += dedupedItems.length;
      }

      // Mark batch as processed
      markBatchProcessed(messageIds);
      totalMessagesProcessed += messageIds.length;
    } catch (err: any) {
      const errorMsg = `Batch ${batchNum + 1} extraction error: ${err.message || String(err)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      continue;
    }
  }

  const remaining = fetchUnprocessedCount();

  return {
    total_tokens_used: totalTokens,
    activities_extracted: totalActivities,
    messages_processed: totalMessagesProcessed,
    messages_remaining: remaining,
    errors,
  };
}
