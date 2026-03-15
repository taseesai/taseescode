export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ERR_NETWORK', '429', '500', '502', '503', '529'],
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(error: any, options: RetryOptions): boolean {
  const msg = (error?.message || '').toLowerCase();
  const code = error?.code || '';
  const status = error?.response?.status?.toString() || '';

  return options.retryableErrors.some(e =>
    msg.includes(e.toLowerCase()) || code === e || status === e
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === opts.maxRetries || !isRetryable(error, opts)) {
        throw error;
      }

      const delay = Math.min(
        opts.initialDelayMs * Math.pow(2, attempt) + Math.random() * 500,
        opts.maxDelayMs
      );

      await sleep(delay);
    }
  }

  throw lastError;
}
