export type ISODateString = string;

export type Week2SubscriptionStatus = 'active' | 'disabled' | 'error';
export type Week2SubscriptionSource = 'manual' | 'opml' | 'mock';

export interface Week2Subscription {
  id: string;
  title: string;
  feedUrl: string;
  siteUrl?: string;
  groupName?: string;
  source: Week2SubscriptionSource;
  status: Week2SubscriptionStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Week2SubscriptionProvider {
  listActiveSubscriptions(): Promise<Week2Subscription[]>;
}

export type SubscriptionSaveResult = {
  saved: Week2Subscription[];
  skipped: Array<{
    reason: 'duplicate' | 'invalid-url';
    title?: string;
    feedUrl?: string;
    message: string;
  }>;
};
