import { mockDataset } from '../../core/mockData';
import type { MercuryMockDataset, Week2Article, Week2ReaderDataPort } from '../../core/types';

export const readerFeature = {
  key: 'reader',
  ownerTasks: ['T6', 'T7'],
  status: 'week2-reader-data-port-ready'
} as const;

export function createMockWeek2ReaderDataPort(dataset: MercuryMockDataset = mockDataset): Week2ReaderDataPort {
  return {
    async listFeeds() {
      return dataset.feeds;
    },

    async listArticles(query = {}) {
      return dataset.articles.filter((article) => matchesArticleQuery(article, query));
    },

    async getArticleContent(articleId: string) {
      return dataset.contents.find((content) => content.articleId === articleId) ?? null;
    }
  };
}

export const mockWeek2ReaderDataPort = createMockWeek2ReaderDataPort();

function matchesArticleQuery(
  article: Week2Article,
  query: { feedId?: string; searchText?: string }
) {
  if (query.feedId && article.feedId !== query.feedId) {
    return false;
  }

  const normalizedSearch = query.searchText?.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return [article.title, article.excerpt, article.author, article.url, ...article.tags]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedSearch));
}
