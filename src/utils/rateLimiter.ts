/**
 * Client-side rate limiter to prevent API abuse
 */

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(private options: RateLimitOptions) {}

  /**
   * Check if a request is allowed
   * @param key - Unique identifier for the rate limit (e.g., 'api', 'chat', 'diagnosis')
   * @returns true if request is allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove requests outside the time window
    const validRequests = requests.filter((timestamp) => now - timestamp < this.options.windowMs);
    
    if (validRequests.length >= this.options.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  /**
   * Get time until next request is allowed (in milliseconds)
   */
  getTimeUntilNext(key: string): number {
    const requests = this.requests.get(key) || [];
    if (requests.length < this.options.maxRequests) {
      return 0;
    }
    
    const oldestRequest = Math.min(...requests);
    const timeSinceOldest = Date.now() - oldestRequest;
    return Math.max(0, this.options.windowMs - timeSinceOldest);
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.requests.clear();
  }
}

// Default rate limiters for different API endpoints
export const apiRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 10 requests per minute
});

export const chatRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60000, // 20 requests per minute
});

export const diagnosisRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000, // 5 requests per minute
});

