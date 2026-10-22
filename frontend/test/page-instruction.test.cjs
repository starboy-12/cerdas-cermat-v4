'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

test('quiz instruction is placed in the right page bottom-right footer', () => {
  assert.match(
    html,
    /<div class="page-bottom">\s*<span class="page-number" id="right-page-number">[\s\S]*?<\/span>\s*<span class="page-instruction" id="page-instruction">Lingkari jawaban yang paling tepat\.<\/span>\s*<\/div>/,
  );
});
