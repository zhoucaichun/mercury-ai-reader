import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createJsonWeek2StoragePort } from './json-week2-storage';

const tempDirs: string[] = [];

function createTempUserDataPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-json-storage-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('createJsonWeek2StoragePort', () => {
  it('compacts historical feed URL variants when listing feeds', async () => {
    const userDataPath = createTempUserDataPath();
    const databasePath = path.join(userDataPath, 'mercury-week2-fallback.json');
    fs.writeFileSync(
      databasePath,
      JSON.stringify({
        feeds: [
          {
            id: '1',
            title: '阮一峰的网络日志',
            feedUrl: 'https://www.ruanyifeng.com/blog/atom.xml',
            siteUrl: 'http://www.ruanyifeng.com/blog/',
            unreadCount: 1,
            status: 'ready',
            lastSyncedAt: '2026-06-29T06:59:03.853Z',
            isEnabled: true
          },
          {
            id: '2',
            title: '阮一峰的网络日志',
            feedUrl: 'https://www.ruanyifeng.com/blog/atom.xml?prismTest=30',
            siteUrl: 'http://www.ruanyifeng.com/blog/',
            unreadCount: 0,
            status: 'ready',
            lastSyncedAt: '2026-06-29T06:41:43.195Z',
            isEnabled: true
          }
        ],
        articles: [
          {
            id: '1',
            feedId: '1',
            title: 'Article',
            url: 'https://example.com/article',
            excerpt: '',
            readState: 'unread',
            isRead: false,
            isStarred: false,
            estimatedMinutes: 1,
            tags: []
          }
        ],
        contents: [],
        nextFeedId: 3,
        nextArticleId: 2
      }),
      'utf8'
    );

    const storage = createJsonWeek2StoragePort(userDataPath);
    const feeds = await storage.listFeeds();

    expect(feeds).toHaveLength(1);
    expect(feeds[0].feedUrl).toBe('https://www.ruanyifeng.com/blog/atom.xml');

    const savedState = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
    expect(savedState.feeds).toHaveLength(1);
  });

  it('does not merge different meaningful query feeds', async () => {
    const userDataPath = createTempUserDataPath();
    const storage = createJsonWeek2StoragePort(userDataPath);

    await storage.saveFeeds([
      { id: 'auto', title: 'World', feedUrl: 'https://example.com/feed?category=world', unreadCount: 0, status: 'ready' },
      { id: 'auto', title: 'Tech', feedUrl: 'https://example.com/feed?category=tech', unreadCount: 0, status: 'ready' }
    ]);

    expect(await storage.listFeeds()).toHaveLength(2);
  });
});
