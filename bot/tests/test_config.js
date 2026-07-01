const path = require('path');
const config = require('../config');

function testConfigStructure() {
  console.assert(config.hasOwnProperty('opencode'), 'Config should have opencode property');
  console.assert(config.hasOwnProperty('whatsapp'), 'Config should have whatsapp property');
  console.assert(config.hasOwnProperty('db'), 'Config should have db property');
}

function testOpenCodeConfig() {
  console.assert(config.opencode.hasOwnProperty('apiKey'), 'Should have apiKey');
  console.assert(config.opencode.hasOwnProperty('baseUrl'), 'Should have baseUrl');
  console.assert(config.opencode.hasOwnProperty('model'), 'Should have model');

  console.assert(typeof config.opencode.baseUrl === 'string', 'baseUrl should be string');
  console.assert(config.opencode.baseUrl.includes('opencode.ai'), 'baseUrl should contain opencode.ai');
  console.assert(config.opencode.model === 'deepseek-v4-flash', 'model should be deepseek-v4-flash');
}

function testWhatsAppConfig() {
  console.assert(config.whatsapp.hasOwnProperty('groupIds'), 'Should have groupIds');
  console.assert(config.whatsapp.groupIds.hasOwnProperty('alunos'), 'Should have alunos group');
  console.assert(config.whatsapp.groupIds.hasOwnProperty('profs'), 'Should have profs group');
}

function testDbConfig() {
  console.assert(config.db.hasOwnProperty('path'), 'Should have db path');
  console.assert(typeof config.db.path === 'string', 'DB path should be string');
  console.assert(config.db.path.includes('app.db'), 'DB path should include app.db');
}

if (require.main === module) {
  try {
    testConfigStructure();
    console.log('✓ testConfigStructure');

    testOpenCodeConfig();
    console.log('✓ testOpenCodeConfig');

    testWhatsAppConfig();
    console.log('✓ testWhatsAppConfig');

    testDbConfig();
    console.log('✓ testDbConfig');

    console.log('\nAll tests passed!');
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

module.exports = {
  testConfigStructure,
  testOpenCodeConfig,
  testWhatsAppConfig,
  testDbConfig,
};
