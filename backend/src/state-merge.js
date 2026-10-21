'use strict';

function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function copy(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

function mergeValue(base, local, remote) {
  if (equal(local, base)) return copy(remote);
  if (equal(remote, base)) return copy(local);
  if (Array.isArray(local) && Array.isArray(remote)) {
    const valuesHaveIds = [...local, ...remote].every((value) => value && typeof value === 'object' && typeof value.id === 'string');
    if (!valuesHaveIds) return copy(local);
    const baseById = new Map((Array.isArray(base) ? base : []).map((value) => [value.id, value]));
    const localById = new Map(local.map((value) => [value.id, value]));
    const remoteById = new Map(remote.map((value) => [value.id, value]));
    const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()]);
    const merged = [];
    for (const id of ids) {
      const value = mergeValue(baseById.get(id), localById.get(id), remoteById.get(id));
      if (value !== undefined) merged.push(value);
    }
    return merged;
  }
  if (local && remote && typeof local === 'object' && typeof remote === 'object' && !Array.isArray(local) && !Array.isArray(remote)) {
    const baseObject = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
    const merged = {};
    for (const key of new Set([...Object.keys(baseObject), ...Object.keys(local), ...Object.keys(remote)])) {
      const value = mergeValue(baseObject[key], local[key], remote[key]);
      if (value !== undefined) merged[key] = value;
    }
    return merged;
  }
  return copy(local);
}

module.exports = { mergeValue };
