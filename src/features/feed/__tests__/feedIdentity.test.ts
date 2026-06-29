import { describe, expect, it } from 'vitest';
import { areSameFeedUrl, createFeedIdentityKey } from '../feedIdentity';

describe('feedIdentity', () => {
  it('treats Prism test and tracking query variants as the same feed', () => {
    expect(
      areSameFeedUrl(
        'https://www.ruanyifeng.com/blog/atom.xml',
        'https://www.ruanyifeng.com/blog/atom.xml?prismTest=30&utm_source=test#top'
      )
    ).toBe(true);
  });

  it('keeps meaningful feed query parameters', () => {
    expect(createFeedIdentityKey('https://example.com/feed?category=world')).not.toBe(
      createFeedIdentityKey('https://example.com/feed?category=tech')
    );
  });
});
