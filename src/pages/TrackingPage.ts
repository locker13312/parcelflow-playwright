import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class TrackingPage extends BasePage {
  readonly path = '/#/track';
  readonly input: Locator;
  readonly submit: Locator;
  readonly status: Locator;
  readonly historyItems: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    super(page);
    this.input = page.getByTestId('track-input');
    this.submit = page.getByTestId('track-submit');
    this.status = page.getByTestId('track-status');
    this.historyItems = page.getByTestId('history-item');
    this.error = page.getByTestId('track-error');
  }

  async track(trackingNumber: string): Promise<void> {
    await this.input.fill(trackingNumber);
    await this.submit.click();
  }
}
