/* Shared wire format. Only the server advances Match; clients restore render state. */
(function(root) {
  'use strict';
  const DV = root.DV = root.DV || {};
  const VERSION = 1;
  const unsafe = new Set(['__proto__', 'prototype', 'constructor']);

  function snapshotMatch(match) {
    const specs = new Map((DV.roster || []).map(spec => [spec, spec.id]));
    const fighters = new Map(match.fighters.map((fighter, side) => [fighter, side]));
    const profiles = new Map();
    for (const spec of DV.roster || []) {
      const profile = DV.assistProfile?.(spec);
      if (profile) profiles.set(profile, spec.id);
    }
    function encode(value) {
      if (typeof value === 'number' && !Number.isFinite(value)) return { $number: String(value) };
      if (value === null || typeof value !== 'object') return value;
      if (fighters.has(value)) return { $fighter: fighters.get(value) };
      if (specs.has(value)) return { $spec: specs.get(value) };
      if (profiles.has(value)) return { $profile: profiles.get(value) };
      if (value instanceof Set) return { $set: Array.from(value, encode) };
      if (Array.isArray(value)) return value.map(encode);
      return object(value);
    }
    function object(value, omit = new Set()) {
      const result = {};
      for (const key of Object.keys(value)) {
        if (omit.has(key) || unsafe.has(key) || typeof value[key] === 'function' || value[key] === undefined) continue;
        result[key] = encode(value[key]);
      }
      return result;
    }
    const snapshot = object(match, new Set(['fighters', 'onEvent', 'commandContext']));
    snapshot.version = VERSION;
    snapshot.fighters = match.fighters.map(fighter => ({
      fighterId: fighter.spec.id, assistId: fighter.assist.id,
      ...object(fighter, new Set(['spec', 'assist']))
    }));
    return snapshot;
  }

  function applySnapshot(match, snapshot) {
    if (!snapshot || snapshot.version !== VERSION || !Array.isArray(snapshot.fighters) || snapshot.fighters.length !== 2) {
      throw new Error('不兼容的对局快照');
    }
    const roster = new Map((DV.roster || []).map(spec => [spec.id, spec]));
    for (const fighter of snapshot.fighters) {
      if (!fighter || !roster.has(fighter.fighterId) || !roster.has(fighter.assistId)) throw new Error('快照角色不存在');
    }
    const restored = snapshot.fighters.map(() => ({}));
    function decode(value) {
      if (value === null || typeof value !== 'object') return value;
      if (Array.isArray(value)) return value.map(decode);
      if (Object.hasOwn(value, '$fighter')) return restored[value.$fighter];
      if (Object.hasOwn(value, '$spec')) return roster.get(value.$spec);
      if (Object.hasOwn(value, '$profile')) return DV.assistProfile?.(roster.get(value.$profile));
      if (Object.hasOwn(value, '$set')) return new Set(value.$set.map(decode));
      if (Object.hasOwn(value, '$number')) return value.$number === 'Infinity' ? Infinity : value.$number === '-Infinity' ? -Infinity : NaN;
      const object = {};
      for (const key of Object.keys(value)) if (!unsafe.has(key)) object[key] = decode(value[key]);
      return object;
    }
    snapshot.fighters.forEach((fighter, side) => {
      for (const key of Object.keys(fighter)) {
        if (!unsafe.has(key) && key !== 'fighterId' && key !== 'assistId') restored[side][key] = decode(fighter[key]);
      }
      restored[side].spec = roster.get(fighter.fighterId);
      restored[side].assist = roster.get(fighter.assistId);
    });
    // Drop obsolete transient fields from earlier snapshots without replacing callbacks.
    for (const key of Object.keys(match)) if (key !== 'onEvent' && key !== 'fighters' && !Object.hasOwn(snapshot, key)) delete match[key];
    for (const key of Object.keys(snapshot)) {
      if (!unsafe.has(key) && !['version', 'fighters', 'onEvent'].includes(key)) match[key] = decode(snapshot[key]);
    }
    match.fighters = restored;
    return match;
  }

  const protocol = { VERSION, snapshotMatch, applySnapshot };
  DV.NetProtocol = protocol;
  if (typeof module !== 'undefined' && module.exports) module.exports = protocol;
})(globalThis);
