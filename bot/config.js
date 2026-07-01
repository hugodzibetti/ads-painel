const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  opencode: {
    apiKey: process.env.OPENCODE_API_KEY,
    baseUrl: process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1',
    model: process.env.OPENCODE_MODEL || 'deepseek-v4-flash',
  },
  whatsapp: {
    groupIds: {
      alunos: process.env.WHATSAPP_GROUP_ID_ALUNOS,
      profs: process.env.WHATSAPP_GROUP_ID_PROFS,
    },
  },
  db: {
    path: path.resolve(__dirname, '..', process.env.DB_PATH || './data/app.db'),
  },
};

module.exports = config;
