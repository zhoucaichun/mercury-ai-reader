import { normalizeFeedUrl, parseOpmlText } from '../opml/index';
import { mockActiveSubscriptions } from './mockSubscriptions';
import type { SubscriptionSaveResult, Week2Subscription, Week2SubscriptionProvider } from './types';

export type { SubscriptionSaveResult, Week2Subscription, Week2SubscriptionProvider } from './types';
export { mockActiveSubscriptions } from './mockSubscriptions';

export type CreateWeek2SubscriptionProviderOptions = {
  initialSubscriptions?: Week2Subscription[];
};

export function createWeek2SubscriptionProvider(
  options: CreateWeek2SubscriptionProviderOptions = {}
): Week2SubscriptionProvider {
  const store = new InMemorySubscriptionStore(options.initialSubscriptions ?? mockActiveSubscriptions);

  return {
    listActiveSubscriptions: () => store.listActiveSubscriptions()
  };
}

export class InMemorySubscriptionStore implements Week2SubscriptionProvider {
  private subscriptions: Week2Subscription[];

  constructor(initialSubscriptions: Week2Subscription[] = []) {
    this.subscriptions = dedupeSubscriptions(initialSubscriptions);
  }

  async listActiveSubscriptions(): Promise<Week2Subscription[]> {
    return this.subscriptions.filter((subscription) => subscription.status === 'active');
  }

  async listSubscriptions(): Promise<Week2Subscription[]> {
    return [...this.subscriptions];
  }

  async importOpmlText(opmlText: string): Promise<SubscriptionSaveResult> {
    const parsed = parseOpmlText(opmlText);
    const saved: Week2Subscription[] = [];
    const skipped: SubscriptionSaveResult['skipped'] = parsed.issues.map((issue) => ({
      reason: issue.type === 'duplicate' ? 'duplicate' : 'invalid-url',
      title: issue.title,
      feedUrl: issue.feedUrl,
      message: issue.message
    }));
    const existingFeedUrls = new Set(
      this.subscriptions.map((subscription) => subscription.feedUrl.toLowerCase())
    );

    for (const subscription of parsed.subscriptions) {
      const dedupeKey = subscription.feedUrl.toLowerCase();

      if (existingFeedUrls.has(dedupeKey)) {
        skipped.push({
          reason: 'duplicate',
          title: subscription.title,
          feedUrl: subscription.feedUrl,
          message: `Skipped duplicate subscription "${subscription.title}".`
        });
        continue;
      }

      existingFeedUrls.add(dedupeKey);
      this.subscriptions.push(subscription);
      saved.push(subscription);
    }

    return { saved, skipped };
  }

  async addManualSubscription(input: {
    title?: string;
    feedUrl: string;
    siteUrl?: string;
    groupName?: string;
  }): Promise<SubscriptionSaveResult> {
    const now = new Date().toISOString();
    const feedUrl = normalizeFeedUrl(input.feedUrl);

    if (!feedUrl) {
      return {
        saved: [],
        skipped: [
          {
            reason: 'invalid-url',
            title: input.title,
            feedUrl: input.feedUrl,
            message: 'Skipped manual subscription because feedUrl is not a valid HTTP(S) URL.'
          }
        ]
      };
    }

    if (this.subscriptions.some((subscription) => subscription.feedUrl.toLowerCase() === feedUrl.toLowerCase())) {
      return {
        saved: [],
        skipped: [
          {
            reason: 'duplicate',
            title: input.title,
            feedUrl,
            message: 'Skipped manual subscription because the feed URL already exists.'
          }
        ]
      };
    }

    const subscription: Week2Subscription = {
      id: createManualSubscriptionId(feedUrl),
      title: input.title?.trim() || feedUrl,
      feedUrl,
      siteUrl: input.siteUrl,
      groupName: input.groupName,
      source: 'manual',
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    this.subscriptions.push(subscription);

    return { saved: [subscription], skipped: [] };
  }

  async disableSubscription(subscriptionId: string): Promise<void> {
    this.updateStatus(subscriptionId, 'disabled');
  }

  async enableSubscription(subscriptionId: string): Promise<void> {
    this.updateStatus(subscriptionId, 'active');
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    this.subscriptions = this.subscriptions.filter((subscription) => subscription.id !== subscriptionId);
  }

  private updateStatus(subscriptionId: string, status: Week2Subscription['status']): void {
    const now = new Date().toISOString();
    this.subscriptions = this.subscriptions.map((subscription) =>
      subscription.id === subscriptionId ? { ...subscription, status, updatedAt: now } : subscription
    );
  }
}

function dedupeSubscriptions(subscriptions: Week2Subscription[]): Week2Subscription[] {
  const seen = new Set<string>();
  const deduped: Week2Subscription[] = [];

  for (const subscription of subscriptions) {
    const feedUrl = normalizeFeedUrl(subscription.feedUrl);

    if (!feedUrl) {
      continue;
    }

    const dedupeKey = feedUrl.toLowerCase();

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    deduped.push({ ...subscription, feedUrl });
  }

  return deduped;
}

function createManualSubscriptionId(feedUrl: string): string {
  const hash = Array.from(feedUrl).reduce((acc, char) => {
    return (acc * 33 + char.charCodeAt(0)) >>> 0;
  }, 5381);

  return `sub-manual-${hash.toString(36)}`;
}
