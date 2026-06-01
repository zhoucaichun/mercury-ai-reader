import type { Week2Subscription } from './types';

const MOCK_CREATED_AT = '2026-06-01T00:00:00.000Z';

export const mockActiveSubscriptions: Week2Subscription[] = [
  {
    id: 'sub-bbc-news',
    title: 'BBC News',
    feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
    siteUrl: 'https://www.bbc.com/news',
    groupName: 'News',
    source: 'mock',
    status: 'active',
    createdAt: MOCK_CREATED_AT,
    updatedAt: MOCK_CREATED_AT
  }
];
