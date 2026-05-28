import type Database from 'better-sqlite3';
import { createFeedStore } from './stores/feedStore';
import { createEntryStore } from './stores/entryStore';
import { createContentStore } from './stores/contentStore';
import type { Feed, Entry, Content } from './types';

export interface SeedOptions {
  mockFeeds?: boolean;
  mockEntries?: boolean;
  mockContents?: boolean;
}

const MOCK_FEEDS: Array<Omit<Feed, 'id' | 'createdAt'>> = [
  {
    title: 'Paul Graham – Essays',
    feedUrl: 'https://www.paulgraham.com/rss.html',
    siteUrl: 'https://www.paulgraham.com',
    description: 'Essays by Paul Graham',
    feedParserVersion: 1,
    lastFetchedAt: '2026-05-28T10:00:00.000Z',
  },
  {
    title: 'Hacker News – Front Page',
    feedUrl: 'https://hnrss.org/frontpage',
    siteUrl: 'https://news.ycombinator.com',
    description: 'Top stories from Hacker News',
    feedParserVersion: 1,
    lastFetchedAt: '2026-05-28T09:30:00.000Z',
  },
  {
    title: 'CSS-Tricks',
    feedUrl: 'https://css-tricks.com/feed/',
    siteUrl: 'https://css-tricks.com',
    description: 'Tips, Tricks, and Techniques on using Cascading Style Sheets',
    feedParserVersion: 1,
    lastFetchedAt: '2026-05-27T18:00:00.000Z',
  },
];

interface MockEntryDef {
  guid: string;
  url: string;
  title: string;
  author: string;
  publishedAt: string;
  summary: string;
  isRead?: boolean;
  isStarred?: boolean;
}

const MOCK_ENTRIES_BY_FEED: Record<string, MockEntryDef[]> = {
  'https://www.paulgraham.com/rss.html': [
    {
      guid: 'pg-how-to-do-great-work',
      url: 'https://www.paulgraham.com/greatwork.html',
      title: 'How to Do Great Work',
      author: 'Paul Graham',
      publishedAt: '2026-05-20T08:00:00.000Z',
      summary: 'A guide to doing great work in any field.',
    },
    {
      guid: 'pg-maker-schedule',
      url: 'https://www.paulgraham.com/makersschedule.html',
      title: "Maker's Schedule, Manager's Schedule",
      author: 'Paul Graham',
      publishedAt: '2026-05-15T12:00:00.000Z',
      summary: 'Why programmers prefer a different schedule from managers.',
      isRead: true,
    },
    {
      guid: 'pg-do-things-dont-scale',
      url: 'https://www.paulgraham.com/dsq.html',
      title: 'Do Things that Don\'t Scale',
      author: 'Paul Graham',
      publishedAt: '2026-05-10T09:00:00.000Z',
      summary: 'The most common answer to how to start a startup.',
      isRead: true,
      isStarred: true,
    },
  ],
  'https://hnrss.org/frontpage': [
    {
      guid: 'hn-rust-2026',
      url: 'https://blog.rust-lang.org/2026/05/rust-2026.html',
      title: 'Rust 2026 Edition Announcement',
      author: 'Rust Team',
      publishedAt: '2026-05-27T14:00:00.000Z',
      summary: 'The Rust 2026 edition brings major improvements to the language.',
      isStarred: true,
    },
    {
      guid: 'hn-webgpu-standard',
      url: 'https://web.dev/webgpu-release',
      title: 'WebGPU is Now a W3C Standard',
      author: 'Chrome Team',
      publishedAt: '2026-05-26T10:00:00.000Z',
      summary: 'WebGPU has been officially standardized.',
      isRead: true,
    },
    {
      guid: 'hn-local-first-movement',
      url: 'https://localfirstweb.dev',
      title: 'The Local-First Software Movement',
      author: 'inkandswitch',
      publishedAt: '2026-05-25T16:00:00.000Z',
      summary: 'Why local-first is the future of software.',
    },
    {
      guid: 'hn-sqlite-performance',
      url: 'https://fly.io/blog/sqlite-performance',
      title: 'SQLite Performance Deep Dive',
      author: 'Fly.io',
      publishedAt: '2026-05-24T11:00:00.000Z',
      summary: 'Making SQLite fast enough for production workloads.',
    },
  ],
  'https://css-tricks.com/feed/': [
    {
      guid: 'ct-modern-css',
      url: 'https://css-tricks.com/modern-css-2026',
      title: 'Modern CSS in 2026',
      author: 'CSS-Tricks Staff',
      publishedAt: '2026-05-22T08:00:00.000Z',
      summary: 'A look at the CSS features that matter most in 2026.',
      isRead: true,
    },
    {
      guid: 'ct-container-queries',
      url: 'https://css-tricks.com/container-queries-guide',
      title: 'A Complete Guide to Container Queries',
      author: 'CSS-Tricks Staff',
      publishedAt: '2026-05-18T10:00:00.000Z',
      summary: 'Everything you need to know about CSS container queries.',
    },
    {
      guid: 'ct-color-mix',
      url: 'https://css-tricks.com/color-mix-function',
      title: 'Getting Started with CSS color-mix()',
      author: 'CSS-Tricks Staff',
      publishedAt: '2026-05-12T09:00:00.000Z',
      summary: 'How to use the color-mix() function for dynamic palettes.',
      isRead: true,
      isStarred: true,
    },
  ],
};

function makeHtmlContent(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><title>${title}</title></head><body><article><h1>${title}</h1>${body}</article></body></html>`;
}

function makeCleanedHtml(title: string, body: string): string {
  return `<article><h1>${title}</h1>${body}</article>`;
}

function makeMarkdown(title: string, body: string): string {
  return `# ${title}\n\n${body}`;
}

export function seedMockData(db: Database.Database, options: SeedOptions = {}): void {
  const opts = {
    mockFeeds: options.mockFeeds ?? true,
    mockEntries: options.mockEntries ?? true,
    mockContents: options.mockContents ?? true,
  };

  const feedStore = createFeedStore(db);
  const entryStore = createEntryStore(db);
  const contentStore = createContentStore(db);

  db.transaction(() => {
    if (!opts.mockFeeds) return;

    const feeds = feedStore.upsertMany(MOCK_FEEDS);
    if (!opts.mockEntries) return;

    const allEntries: Array<{ entry: Entry; feedUrl: string }> = [];
    for (const feed of feeds) {
      const defs = MOCK_ENTRIES_BY_FEED[feed.feedUrl] ?? [];
      for (const def of defs) {
        const entry = entryStore.upsert({
          feedId: feed.id,
          guid: def.guid,
          url: def.url,
          title: def.title,
          author: def.author,
          publishedAt: def.publishedAt,
          summary: def.summary,
        });
        if (def.isRead) entryStore.markRead(entry.id, true);
        if (def.isStarred) entryStore.markStarred(entry.id, true);
        allEntries.push({ entry, feedUrl: feed.feedUrl });
      }
    }

    if (!opts.mockContents) return;

    for (const { entry } of allEntries) {
      const body = `<p>This is mock content for "${entry.title}". It contains enough text to demonstrate the three-layer content system.</p><p>The article discusses important topics in modern software development and technology.</p>`;
      contentStore.upsert({
        entryId: entry.id,
        html: makeHtmlContent(entry.title ?? 'Untitled', body),
        cleanedHtml: makeCleanedHtml(entry.title ?? 'Untitled', body),
        readabilityTitle: entry.title,
        readabilityByline: entry.author,
        readabilityVersion: 1,
        markdown: makeMarkdown(entry.title ?? 'Untitled', 'This is mock content for "' + entry.title + '". It contains enough text to demonstrate the three-layer content system.\n\nThe article discusses important topics in modern software development and technology.'),
        markdownVersion: 1,
        displayMode: 'cleaned',
        documentBaseUrl: entry.url,
        pipelineType: 'default',
        resolvedIntermediateContent: null,
      });
    }
  })();
}

export function cleanSeedData(db: Database.Database): void {
  db.transaction(() => {
    db.prepare("DELETE FROM content WHERE entryId IN (SELECT e.id FROM entry e JOIN feed f ON e.feedId = f.id WHERE f.feedUrl IN ('https://www.paulgraham.com/rss.html', 'https://hnrss.org/frontpage', 'https://css-tricks.com/feed/'))").run();
    db.prepare("DELETE FROM entry WHERE feedId IN (SELECT id FROM feed WHERE feedUrl IN ('https://www.paulgraham.com/rss.html', 'https://hnrss.org/frontpage', 'https://css-tricks.com/feed/'))").run();
    db.prepare("DELETE FROM feed WHERE feedUrl IN ('https://www.paulgraham.com/rss.html', 'https://hnrss.org/frontpage', 'https://css-tricks.com/feed/')").run();
  })();
}
