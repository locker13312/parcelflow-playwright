import { test as setup, expect } from '../src/fixtures/test';
import { env } from '../src/config/env';

// Logs in once through the UI and saves the session for all UI tests.
setup('authenticate as dispatcher', async ({ page, loginPage }) => {
  await loginPage.open();
  await loginPage.login(env.dispatcher.email, env.dispatcher.password);
  await expect(loginPage.currentUser).toHaveText(env.dispatcher.name);
  await page.context().storageState({ path: env.storageStatePath });
});
