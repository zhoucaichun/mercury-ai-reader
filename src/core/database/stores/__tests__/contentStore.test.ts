import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../init';
import { createFeedStore } from '../feedStore';
import { createEntryStore } from '../entryStore';
import { createContentStore } from '../contentStore';

describe('ContentStore', () => {
  let db: Database.Database;
  let entryId: number;

  beforeEach(() => {
    db = createInMemoryDatabase();
    const feedStore = createFeedStore(db);
    const entryStore = createEntryStore(db);
    const contentStore = createContentStore(db);

    const feed = feedStore.upsert({
      feedUrl: 'https://example.com/rss',
      siteUrl: null,
      description: null,
      feedParserVersion: null,
      lastFetchedAt: null,
    });
    const entry = entryStore.upsert({
      feedId: feed.id,
      guid: 'test-article',
      url: 'https://example.com/article',
      title: 'Test Article',
      author: null,
      publishedAt: null,
      summary: null,
    });
    entryId = entry.id;
  });

  it('creates content for an entry', () => {
    const contentStore = createContentStore(db);
    const content = contentStore.upsert({
      entryId,
      html: '<html><body>Raw HTML</body></html>',
      cleanedHtml: '<div>Cleaned HTML</div>',
      readabilityTitle: 'Test Article',
      readabilityByline: 'Author',
      readabilityVersion: 1,
      markdown: '# Test Article\n\nCleaned content',
      markdownVersion: 1,
      displayMode: 'cleaned',
      documentBaseUrl: 'https://example.com',
      pipelineType: 'default',
      resolvedIntermediateContent: null,
    });

    expect(content.id).toBeGreaterThan(0);
    expect(content.entryId).toBe(entryId);
    expect(content.html).toBe('<html><body>Raw HTML</body></html>');
    expect(content.cleanedHtml).toBe('<div>Cleaned HTML</div>');
    expect(content.markdown).toBe('# Test Article\n\nCleaned content');
  });

  it('upserts by entryId — same entryId updates existing', () => {
    const contentStore = createContentStore(db);

    contentStore.upsert({
      entryId,
      html: 'version 1',
      cleanedHtml: null,
      readabilityTitle: null,
      readabilityByline: null,
      readabilityVersion: null,
      markdown: null,
      markdownVersion: null,
      displayMode: 'web',
      documentBaseUrl: null,
      pipelineType: 'default',
      resolvedIntermediateContent: null,
    });

    const updated = contentStore.upsert({
      entryId,
      html: 'version 2',
      cleanedHtml: '<p>cleaned</p>',
      readabilityTitle: 'Title',
      readabilityByline: null,
      readabilityVersion: 2,
      markdown: '# Title\ncleaned',
      markdownVersion: 2,
      displayMode: 'cleaned',
      documentBaseUrl: 'https://example.com',
      pipelineType: 'default',
      resolvedIntermediateContent: null,
    });

    expect(updated.html).toBe('version 2');
    expect(updated.cleanedHtml).toBe('<p>cleaned</p>');

    // Should be only 1 content row
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM content').get() as { cnt: number }).cnt;
    expect(count).toBe(1);
  });

  it('getByEntryId returns content for given entry', () => {
    const contentStore = createContentStore(db);
    contentStore.upsert({
      entryId,
      html: 'test html',
      cleanedHtml: null,
      readabilityTitle: null,
      readabilityByline: null,
      readabilityVersion: null,
      markdown: null,
      markdownVersion: null,
      displayMode: 'web',
      documentBaseUrl: null,
      pipelineType: 'default',
      resolvedIntermediateContent: null,
    });

    const found = contentStore.getByEntryId(entryId);
    expect(found).not.toBeNull();
    expect(found!.html).toBe('test html');
  });

  it('getByEntryId returns null when no content exists', () => {
    const contentStore = createContentStore(db);
    expect(contentStore.getByEntryId(999)).toBeNull();
  });

  it('getLayerState returns correct state for content with all layers', () => {
    const contentStore = createContentStore(db);
    contentStore.upsert({
      entryId,
      html: '<html>source</html>',
      cleanedHtml: '<div>cleaned</div>',
      readabilityTitle: null,
      readabilityByline: null,
      readabilityVersion: 1,
      markdown: '# Title',
      markdownVersion: 1,
      displayMode: 'cleaned',
      documentBaseUrl: null,
      pipelineType: 'default',
      resolvedIntermediateContent: null,
    });

    const state = contentStore.getLayerState(entryId);
    expect(state.hasSourceHtml).toBe(true);
    expect(state.hasCleanedHtml).toBe(true);
    expect(state.hasMarkdown).toBe(true);
    expect(state.readabilityVersion).toBe(1);
    expect(state.markdownVersion).toBe(1);
  });

  it('getLayerState returns correct state for partial content', () => {
    const contentStore = createContentStore(db);
    contentStore.upsert({
      entryId,
      html: 'only html',
      cleanedHtml: null,
      readabilityTitle: null,
      readabilityByline: null,
      readabilityVersion: null,
      markdown: null,
      markdownVersion: null,
      displayMode: 'web',
      documentBaseUrl: null,
      pipelineType: 'default',
      resolvedIntermediateContent: null,
    });

    const state = contentStore.getLayerState(entryId);
    expect(state.hasSourceHtml).toBe(true);
    expect(state.hasCleanedHtml).toBe(false);
    expect(state.hasMarkdown).toBe(false);
    expect(state.readabilityVersion).toBeNull();
    expect(state.markdownVersion).toBeNull();
  });

  it('getLayerState returns all-false for non-existent entry', () => {
    const contentStore = createContentStore(db);
    const state = contentStore.getLayerState(999);
    expect(state.hasSourceHtml).toBe(false);
    expect(state.hasCleanedHtml).toBe(false);
    expect(state.hasMarkdown).toBe(false);
    expect(state.readabilityVersion).toBeNull();
    expect(state.markdownVersion).toBeNull();
  });

  it('content is cascade-deleted when entry is deleted', () => {
    const contentStore = createContentStore(db);
    contentStore.upsert({
      entryId,
      html: 'will be deleted',
      cleanedHtml: null,
      readabilityTitle: null,
      readabilityByline: null,
      readabilityVersion: null,
      markdown: null,
      markdownVersion: null,
      displayMode: 'web',
      documentBaseUrl: null,
      pipelineType: 'default',
      resolvedIntermediateContent: null,
    });

    // Delete the entry (hard delete via SQL since softDelete won't cascade)
    db.prepare('DELETE FROM entry WHERE id = ?').run(entryId);

    expect(contentStore.getByEntryId(entryId)).toBeNull();
  });
});
