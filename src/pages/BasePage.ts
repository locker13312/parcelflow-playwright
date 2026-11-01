import type { Locator, Page } from '@playwright/test';

export abstract class BasePage {
  readonly currentUser: Locator;
  readonly logoutButton: Locator;

  constructor(protected readonly page: Page) {
    this.currentUser = page.getByTestId('current-user');
    this.logoutButton = page.getByTestId('logout');
  }

  abstract readonly path: string;

  async open(): Promise<void> {
    await this.page.goto(this.path);
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
