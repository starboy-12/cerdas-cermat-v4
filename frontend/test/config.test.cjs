'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const configSource = fs.readFileSync(path.join(__dirname, '../config.js'), 'utf8');

function loadConfig({ location, existing = {}, meta = '' }) {
  const window = { ...existing, location };
  const document = { querySelector: () => ({ content: meta }) };
  vm.runInNewContext(configSource, { window, document });
  return window.CERDAS_CONFIG.apiBaseUrl;
}

test('local frontend uses the separate backend API port by default', () => {
  assert.equal(loadConfig({
    location: { port: '5174', protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:5174' },
  }), 'http://localhost:3101/api');
});

test('deployment API configuration overrides the local default', () => {
  assert.equal(loadConfig({
    location: { port: '5174', protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:5174' },
    existing: { CERDAS_CONFIG: { apiBaseUrl: 'https://api.example.test/api' } },
  }), 'https://api.example.test/api');
});

test('same-origin deployments keep using their own API origin', () => {
  assert.equal(loadConfig({
    location: { port: '443', protocol: 'https:', hostname: 'learn.example.test', origin: 'https://learn.example.test' },
  }), 'https://learn.example.test/api');
});
