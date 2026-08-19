/**
 * Platform adapters can implement the same interface later. The first build
 * intentionally has no fake advertisements and always returns unavailable.
 */
export class NoAdService {
  isAvailable() {
    return false;
  }

  async showRewarded() {
    return { completed: false, reason: "not-configured" };
  }

  async showInterstitial() {
    return { shown: false, reason: "not-configured" };
  }
}

export const adService = new NoAdService();
