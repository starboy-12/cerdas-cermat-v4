'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { validateContent } = require('./validation');

function createContentStore(filePath) {
  let contents = {};
  let schools = {};
  let media = {};
  let queue = Promise.resolve();

  async function load() {
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
      contents = parsed && typeof parsed.contents === 'object' && parsed.contents ? parsed.contents : {};
      schools = parsed && typeof parsed.schools === 'object' && parsed.schools ? parsed.schools : {};
      media = parsed && typeof parsed.media === 'object' && parsed.media ? parsed.media : {};
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  function persist() {
    queue = queue.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temp = `${filePath}.${process.pid}.tmp`;
      await fs.writeFile(temp, JSON.stringify({ contents, schools, media }, null, 2), 'utf8');
      await fs.rename(temp, filePath);
    });
    return queue;
  }

  function list({ status, type } = {}) {
    return Object.values(contents).filter((entry) => (!status || entry.status === status) && (!type || entry.type === type));
  }

  function get(id) { return contents[id] || null; }

  async function save(input, actor, { create = false } = {}) {
    const validation = validateContent(input);
    if (!validation.valid) return { error: validation.issues };
    const current = contents[input.id];
    if (create && current) return { conflict: true };
    const now = new Date().toISOString();
    const revision = (current?.revision || 0) + 1;
    const entry = {
      ...input,
      status: current?.status || 'draft',
      reviewer: current?.reviewer || null,
      reviewedAt: current?.reviewedAt || null,
      revision,
      createdAt: current?.createdAt || now,
      updatedAt: now,
      author: current?.author || actor,
      history: [...(current?.history || []), { revision, at: now, actor, status: input.status, snapshot: input }].slice(-100),
      comments: current?.comments || [],
    };
    contents[input.id] = entry;
    await persist();
    return { content: entry };
  }

  async function transition(id, action, actor, comment = '') {
    const current = get(id);
    if (!current) return null;
    const now = new Date().toISOString();
    const nextStatus = { submit: 'in_review', approve: 'approved', publish: 'published', reject: 'rejected', revise: 'draft' }[action];
    if (!nextStatus) return { error: ['Aksi workflow tidak dikenal.'] };
    const allowedFrom = { submit: ['draft', 'rejected'], approve: ['in_review'], publish: ['approved'], reject: ['in_review'], revise: ['in_review', 'rejected', 'approved'] };
    if (!allowedFrom[action].includes(current.status)) return { error: [`Tidak dapat menjalankan ${action} saat status ${current.status}.`] };
    const updated = {
      ...current,
      status: nextStatus,
      reviewer: ['approve', 'reject', 'publish'].includes(action) ? actor : current.reviewer || null,
      reviewedAt: ['approve', 'reject'].includes(action) ? now : current.reviewedAt || null,
      updatedAt: now,
      revision: current.revision + 1,
      comments: comment ? [...current.comments, { actor, text: comment, at: now }].slice(-200) : current.comments,
      history: [...current.history, { revision: current.revision + 1, at: now, actor, status: nextStatus, action, comment }].slice(-100),
    };
    contents[id] = updated;
    await persist();
    return { content: updated };
  }

  async function addComment(id, actor, text) {
    const current = get(id);
    if (!current) return null;
    const now = new Date().toISOString();
    const updated = { ...current, updatedAt: now, comments: [...current.comments, { actor, text, at: now }].slice(-200) };
    contents[id] = updated;
    await persist();
    return { content: updated };
  }

  async function remove(id) {
    if (!contents[id]) return false;
    delete contents[id];
    await persist();
    return true;
  }

  function getSchool(id) { return schools[id] || { schoolId: id, contentIds: [], updatedAt: null, configuredBy: null }; }

  async function saveSchool(id, contentIds, actor) {
    const value = { schoolId: id, contentIds: [...new Set(contentIds)], updatedAt: new Date().toISOString(), configuredBy: actor };
    schools[id] = value;
    await persist();
    return value;
  }

  function listMedia({ status } = {}) { return Object.values(media).filter((asset) => !status || asset.status === status); }

  async function saveMedia(input) {
    const current = media[input.id];
    const asset = { ...input, revision: (current?.revision || 0) + 1, updatedAt: new Date().toISOString() };
    media[input.id] = asset;
    await persist();
    return asset;
  }

  return { load, list, get, save, transition, addComment, remove, getSchool, saveSchool, listMedia, saveMedia };
}

module.exports = { createContentStore };
