import type { Page } from "@playwright/test";

/**
 * Ticks the privacy consent box that every public form shows on its last
 * question. The real checkbox is visually hidden behind the design system's
 * custom box, so it is checked directly.
 */
export async function acceptPrivacyConsent(page: Page): Promise<void> {
  await page.getByTestId("privacy-consent-checkbox").check({ force: true });
}
