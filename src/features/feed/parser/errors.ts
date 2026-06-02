import type { FeedErrorCode } from "./types.js";

export interface FeedErrorOptions {
  feedUrl?: string;
  status?: number;
  details?: unknown;
  cause?: unknown;
}

export class FeedError extends Error {
  readonly code: FeedErrorCode;
  readonly feedUrl?: string;
  readonly status?: number;
  readonly details?: unknown;
  readonly cause?: unknown;

  constructor(code: FeedErrorCode, message: string, options: FeedErrorOptions = {}) {
    super(message);
    this.name = "FeedError";
    this.code = code;
    this.feedUrl = options.feedUrl;
    this.status = options.status;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export function isFeedError(error: unknown): error is FeedError {
  return error instanceof FeedError;
}
