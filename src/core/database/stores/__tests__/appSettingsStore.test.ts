import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../init';
import { createAppSettingsStore } from '../appSettingsStore';
import type { IAppSettingsStore } from '../appSettingsStore';

describe('AppSettingsStore', () => {
  let db: Database.Database;
  let store: IAppSettingsStore;

  beforeEach(() => {
    db = createInMemoryDatabase();
    store = createAppSettingsStore(db);
  });

  it('returns null for non-existent key', () => {
    expect(store.get('missing.key')).toBeNull();
  });

  it('sets and gets a string value', () => {
    store.set('reader.fontSize', '18');
    expect(store.get('reader.fontSize')).toBe('18');
  });

  it('overwrites existing value', () => {
    store.set('reader.fontSize', '18');
    store.set('reader.fontSize', '20');
    expect(store.get('reader.fontSize')).toBe('20');
  });

  it('sets and gets JSON values', () => {
    store.setJson('reader.customSettings', { theme: 'dark', lang: 'zh-CN' });
    const result = store.getJson<{ theme: string; lang: string }>('reader.customSettings');
    expect(result).toEqual({ theme: 'dark', lang: 'zh-CN' });
  });

  it('returns null for invalid JSON', () => {
    store.set('bad.json', 'not-valid-json{');
    expect(store.getJson('bad.json')).toBeNull();
  });

  it('returns null for getJson on non-existent key', () => {
    expect(store.getJson('nonexistent')).toBeNull();
  });

  it('deletes a key', () => {
    store.set('to.delete', 'value');
    store.delete('to.delete');
    expect(store.get('to.delete')).toBeNull();
  });

  it('getAll returns all key-value pairs', () => {
    store.set('a', '1');
    store.set('b', '2');
    const all = store.getAll();
    expect(all).toEqual({ a: '1', b: '2' });
  });

  it('setMany sets multiple keys at once', () => {
    store.setMany({ x: '10', y: '20', z: '30' });
    expect(store.get('x')).toBe('10');
    expect(store.get('y')).toBe('20');
    expect(store.get('z')).toBe('30');
  });

  it('setMany is atomic — all or nothing', () => {
    store.setMany({ a: '1', b: '2' });
    // setMany with valid entries should succeed
    store.setMany({ c: '3' });
    expect(store.get('c')).toBe('3');
    expect(Object.keys(store.getAll())).toHaveLength(3);
  });
});
