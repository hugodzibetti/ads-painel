import whatsappWeb from 'whatsapp-web.js';
const { Client, LocalAuth, MessageTypes } = whatsappWeb;
import qrcode from 'qrcode-terminal';
import path from 'node:path';
import 'dotenv/config';
import { insertMessage, openDb, fetchPendingOutgoing, markOutgoingSent } from '../server/db.js';
import {
  parseCommand,
  routeCommand,
  getPendingApproval,
  handleApprovalResponse,
  clearPendingApproval,
} from './commands.js';

const authDir = path.resolve(path.dirname(process.env.DB_PATH || './data/app.db'), '.wwebjs_auth');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'ads-painel-bot', dataPath: authDir }),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

const groupIdToLabel: Record<string, string> = {};

client.on('qr', (qr: string) => {
  console.log('\n[WhatsApp] QR Code received. Scan it with your phone:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('[WhatsApp] Client is ready!');

  openDb();

  const chats = await client.getChats();
  const groups = chats.filter((chat) => chat.isGroup);

  console.log('\n[WhatsApp] Available groups:');
  groups.forEach((group, idx) => {
    console.log(`  ${idx + 1}. ${group.name} (ID: ${group.id._serialized})`);
  });

  const alunosGroupId = process.env.WHATSAPP_GROUP_ID_ALUNOS;
  const profsGroupId = process.env.WHATSAPP_GROUP_ID_PROFS;

  if (!alunosGroupId || !profsGroupId) {
    console.error(
      '\n[Config] WHATSAPP_GROUP_ID_ALUNOS and WHATSAPP_GROUP_ID_PROFS must be set in .env'
    );
    console.error('Map the groups above to your .env:');
    console.error('  WHATSAPP_GROUP_ID_ALUNOS=<ID of "ADS" group>');
    console.error('  WHATSAPP_GROUP_ID_PROFS=<ID of "1° ADS Fasipe Sorriso" group>');
    process.exit(0);
  }

  groupIdToLabel[alunosGroupId] = 'alunos';
  groupIdToLabel[profsGroupId] = 'profs';

  console.log('\n[Bot] Listening for messages...');
  startOutgoingPoller();
});

client.on('message', async (message: any) => {
  try {
    const chat = message.getChat ? await message.getChat() : null;
    if (!chat || !chat.isGroup) return;

    const chatId = chat.id._serialized;
    const groupLabel = groupIdToLabel[message.from];
    const body = message.body || '';

    const parsed = parseCommand(body);
    if (parsed) {
      clearPendingApproval(chatId);
      const response = await routeCommand(chatId, parsed.command, parsed.args);
      await message.reply(response);
      return;
    }

    const pending = getPendingApproval(chatId);
    if (pending) {
      const response = await handleApprovalResponse(chatId, body);
      if (response !== null) {
        await message.reply(response);
      }
      return;
    }

    if (!groupLabel) return;

    const acceptedTypes = [
      MessageTypes.TEXT,
      MessageTypes.IMAGE,
      MessageTypes.VIDEO,
      MessageTypes.AUDIO,
      MessageTypes.VOICE,
      MessageTypes.DOCUMENT,
    ];
    if (!acceptedTypes.includes(message.type)) return;

    let author: string;
    try {
      const contact = await message.getContact();
      author = contact.pushname || contact.number || message.author || message.from;
    } catch (err) {
      author = message.author || message.from;
    }

    let msgBody = body;
    if (['image', 'video', 'audio', 'ptt', 'document'].includes(message.type)) {
      if (!msgBody) {
        msgBody = `[${message.type}]`;
      }
    }

    const timestamp = new Date(message.timestamp * 1000).toISOString();
    const waMessageId = message.id._serialized;

    insertMessage(waMessageId, groupLabel, author, msgBody, timestamp);

    console.log(
      `[Msg] [${groupLabel}] ${author}: ${msgBody.substring(0, 50)}${msgBody.length > 50 ? '...' : ''}`
    );
  } catch (err: any) {
    console.error('[Error] Failed to process message:', err.message);
  }
});

client.on('auth_failure', (msg: string) => {
  console.error('[Auth] Authentication failed:', msg);
  process.exit(1);
});

client.on('disconnected', (reason: string) => {
  console.error('[WhatsApp] Disconnected:', reason);
  process.exit(1);
});

const MAX_SEND_ATTEMPTS = 3;
const sendAttempts = new Map<number, number>();

function startOutgoingPoller(): void {
  setInterval(async () => {
    const pending = fetchPendingOutgoing();
    for (const msg of pending) {
      try {
        const groupId = Object.entries(groupIdToLabel).find(([, label]) => label === msg.group_label)?.[0];
        if (!groupId) { console.warn(`[Bot] No group ID for label "${msg.group_label}"`); continue; }
        await client.sendMessage(groupId, msg.body);
        markOutgoingSent(msg.id!);
        sendAttempts.delete(msg.id!);
        console.log(`[Bot] Sent outgoing message ${msg.id} to ${msg.group_label}`);
      } catch (err: any) {
        const attempt = (sendAttempts.get(msg.id!) ?? 0) + 1;
        if (attempt < MAX_SEND_ATTEMPTS) {
          sendAttempts.set(msg.id!, attempt);
          console.error(`[Bot] Send failed for message ${msg.id} (attempt ${attempt}/${MAX_SEND_ATTEMPTS}), will retry:`, err.message);
        } else {
          sendAttempts.delete(msg.id!);
          markOutgoingSent(msg.id!);
          console.error(`[Bot] Send failed for message ${msg.id} after ${MAX_SEND_ATTEMPTS} attempts, dropping:`, err.message);
        }
      }
    }
  }, 30000);
}

client.initialize();

process.on('SIGINT', () => {
  console.log('\n[Bot] Shutting down gracefully...');
  client.destroy().then(() => {
    console.log('[Bot] Closed');
    process.exit(0);
  });
});
