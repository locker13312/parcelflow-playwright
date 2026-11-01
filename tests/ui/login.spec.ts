import { test, expect } from '../../src/fixtures/test';
import { env } from '../../src/config/env';

test.describe('Login', () => {
  // These tests check the login itself, so they start without the saved session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('dispatcher logs in and lands on shipments @smoke', async ({ page, loginPage, shipmentsPage }) => {
    await loginPage.open();
    await loginPage.login(env.dispatcher.email, env.dispatcher.password);

    await expect(page).toHaveURL(/#\/shipments$/);
    await expect(shipmentsPage.currentUser).toHaveText(env.dispatcher.name);
  });

  test('shows an error for a wrong password', async ({ loginPage }) => {
    await loginPage.open();
    await loginPage.login(env.dispatcher.email, 'wrong-password');

    await expect(loginPage.error).toHaveText('Invalid email or password');
    await expect(loginPage.heading).toBeVisible();
  });

  test('redirects to login when opening shipments without a session', async ({ page, loginPage }) => {
    await page.goto('/#/shipments');
    await expect(loginPage.heading).toBeVisible();
  });

  test('logout clears the session', async ({ page, loginPage }) => {
    await loginPage.open();
    await loginPage.login(env.dispatcher.email, env.dispatcher.password);
    await loginPage.logout();

    await expect(loginPage.heading).toBeVisible();
    await page.reload();
    await expect(loginPage.heading).toBeVisible();
  });
});
