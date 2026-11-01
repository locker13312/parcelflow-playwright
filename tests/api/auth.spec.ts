import { test } from '../../src/fixtures/test';
import { env } from '../../src/config/env';
import { errorSchema, loginSchema } from '../../src/api/schemas';
import { expectResponse } from '../../src/helpers/assertions';

test.describe('Auth API', () => {
  test('dispatcher logs in with valid credentials @smoke', async ({ guestApi }) => {
    const body = await expectResponse(
      await guestApi.login(env.dispatcher.email, env.dispatcher.password),
      200,
      loginSchema,
    );
    test.expect(body.user.email).toBe(env.dispatcher.email);
  });

  const invalidCredentials = [
    { name: 'wrong password', email: env.dispatcher.email, password: 'wrong' },
    { name: 'unknown email', email: 'nobody@parcelflow.test', password: env.dispatcher.password },
    { name: 'empty credentials', email: '', password: '' },
  ];
  for (const { name, email, password } of invalidCredentials) {
    test(`login is rejected: ${name}`, async ({ guestApi }) => {
      await expectResponse(await guestApi.login(email, password), 401, errorSchema);
    });
  }

  test('protected endpoint requires a token', async ({ guestApi }) => {
    await expectResponse(await guestApi.listShipments(), 401, errorSchema);
  });

  test('protected endpoint rejects an invalid token', async ({ guestApi }) => {
    await expectResponse(await guestApi.withToken('not-a-real-token').listShipments(), 401, errorSchema);
  });
});
