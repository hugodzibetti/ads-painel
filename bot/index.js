const { Client, LocalAuth, MessageTypes } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const { getDb, initializeDb, insertMessage } = require('./db');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'ads-painel-bot' }),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

const groupIdToLabel = {};

client.on('qr', (qr) => {
  console.log('\n[WhatsApp] QR Code received. Scan it with your phone:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('[WhatsApp] Client is ready!');
  initializeDb();

  const chats = await client.getChats();
  const groups = chats.filter((chat) => chat.isGroup);

  console.log('\n[WhatsApp] Available groups:');
  groups.forEach((group, idx) => {
    console.log(`  ${idx + 1}. ${group.name} (ID: ${group.id._serialized})`);
  });

  const { alunos, profs } = config.whatsapp.groupIds;

  if (!alunos || !profs) {
    console.error(
      '\n[Config] WHATSAPP_GROUP_ID_ALUNOS and WHATSAPP_GROUP_ID_PROFS must be set in .env'
    );
    console.error('Map the groups above to your .env:');
    console.error('  WHATSAPP_GROUP_ID_ALUNOS=<ID of "ADS" group>');
    console.error('  WHATSAPP_GROUP_ID_PROFS=<ID of "1° ADS Fasipe Sorriso" group>');
    process.exit(0);
  }

  groupIdToLabel[alunos] = 'alunos';
  groupIdToLabel[profs] = 'profs';

  console.log('\n[Bot] Listening for messages...');
});

client.on('message', async (message) => {
  try {
    const groupLabel = groupIdToLabel[message.from];

    if (!groupLabel) {
      return;
    }

    const chat = message.getChat ? await message.getChat() : null;
    if (!chat || !chat.isGroup) return;

    if (message.type === MessageTypes.NOTIFICATION_CHANNEL_INVITE) return;
    if (message.type === MessageTypes.NOTIFICATION_CHANNEL_ADMIN_RESTRICT) return;
    if (message.type === MessageTypes.NOTIFICATION_CHANNEL_ADMIN_UNRESTRICT) return;
    if (message.type === MessageTypes.SYSTEM) return;
    if (message.type === MessageTypes.STICKER) return;

    const acceptedTypes = [
      MessageTypes.TEXT,
      MessageTypes.IMAGE,
      MessageTypes.VIDEO,
      MessageTypes.AUDIO,
      MessageTypes.PTT,
      MessageTypes.DOCUMENT,
    ];
    if (!acceptedTypes.includes(message.type)) return;

    let author;
    try {
      const contact = await message.getContact();
      author = contact.pushname || contact.number || message.author || message.from;
    } catch (err) {
      author = message.author || message.from;
    }

    let body = message.body || '';
    if (['image', 'video', 'audio', 'ptt', 'document'].includes(message.type)) {
      if (!body) {
        body = `[${message.type}]`;
      }
    }

    const timestamp = new Date(message.timestamp * 1000).toISOString();
    const waMessageId = message.id._serialized;

    insertMessage(waMessageId, groupLabel, author, body, timestamp);

    console.log(
      `[Msg] [${groupLabel}] ${author}: ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}`
    );
  } catch (err) {
    console.error('[Error] Failed to process message:', err.message);
  }
});

client.on('auth_failure', (msg) => {
  console.error('[Auth] Authentication failed:', msg);
  process.exit(1);
});

client.on('disconnected', (reason) => {
  console.error('[WhatsApp] Disconnected:', reason);
  process.exit(1);
});

client.initialize();
