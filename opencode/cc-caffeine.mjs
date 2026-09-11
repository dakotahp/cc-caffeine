import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createHooks } = require('../src/opencode.js');

// OpenCode loads this module and calls the exported plugin function with the
// plugin context, expecting a hooks object back. All logic lives in
// src/opencode.js (shared with the Claude Code path); this file is only the
// ESM adapter OpenCode's plugin loader understands.
export const CcCaffeine = async ctx => {
  return createHooks(ctx);
};

export default CcCaffeine;
