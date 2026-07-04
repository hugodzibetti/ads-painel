import { Client, LocalAuth, MessageTypes } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import 'dotenv/config';
import { insertMessage, openDb, fetchPendingOutgoing, markOutgoingSent } from '../server/db.js';

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'ads-painel-bot' }),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

const groupIdToLabel: Record<string, string> = {};

client.on('qr', (qr: string) => {
  console.log('\n[WhatsApp] QR Code received. Scan it with your phone:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('[WhatsApp] Client is ready!');

  // Initialize database
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
    const groupLabel = groupIdToLabel[message.from];

    if (!groupLabel) {
      return;
    }

    const chat = message.getChat ? await message.getChat() : null;
    if (!chat || !chat.isGroup) return;

    // Filter out system messages and notifications
    if (message.type === MessageTypes.NOTIFICATION_CHANNEL_INVITE) return;
    if (message.type === MessageTypes.NOTIFICATION_CHANNEL_ADMIN_RESTRICT) return;
    if (message.type === MessageTypes.NOTIFICATION_CHANNEL_ADMIN_UNRESTRICT) return;
    if (message.type === MessageTypes.SYSTEM) return;
    if (message.type === MessageTypes.STICKER) return;

    // Only accept specific message types
    const acceptedTypes = [
      MessageTypes.TEXT,
      MessageTypes.IMAGE,
      MessageTypes.VIDEO,
      MessageTypes.AUDIO,
      MessageTypes.PTT,
      MessageTypes.DOCUMENT,
    ];
    if (!acceptedTypes.includes(message.type)) return;

    // Extract author info
    let author: string;
    try {
      const contact = await message.getContact();
      author = contact.pushname || contact.number || message.author || message.from;
    } catch (err) {
      author = message.author || message.from;
    }

    // Extract body content
    let body = message.body || '';
    if (['image', 'video', 'audio', 'ptt', 'document'].includes(message.type)) {
      if (!body) {
        body = `[${message.type}]`;
      }
    }

    // Convert timestamp to ISO format
    const timestamp = new Date(message.timestamp * 1000).toISOString();
    const waMessageId = message.id._serialized;

    // Insert message into database
    insertMessage(waMessageId, groupLabel, author, body, timestamp);

    // Log the message
    console.log(
      `[Msg] [${groupLabel}] ${author}: ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}`
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

function startOutgoingPoller(): void {
  setInterval(async () => {
    const pending = fetchPendingOutgoing();
    for (const msg of pending) {
      try {
        const groupId = Object.entries(groupIdToLabel).find(([, label]) => label === msg.group_label)?.[0];
        if (!groupId) { console.warn(`[Bot] No group ID for label "${msg.group_label}"`); continue; }
        await client.sendMessage(groupId, msg.body);
        markOutgoingSent(msg.id!);
        console.log(`[Bot] Sent outgoing message ${msg.id} to ${msg.group_label}`);
      } catch (err: any) {
        console.error(`[Bot] Failed to send outgoing message ${msg.id}, draining from queue:`, err.message);
        markOutgoingSent(msg.id!);
      }
    }
  }, 30000);
}

// Initialize the WhatsApp client
client.initialize();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Bot] Shutting down gracefully...');
  client.destroy().then(() => {
    console.log('[Bot] Closed');
    process.exit(0);
  });
});
