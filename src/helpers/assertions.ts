import { expect, type APIResponse } from '@playwright/test';
import type { z } from 'zod';

/** Checks the status code and validates the JSON body against a schema. Returns the parsed body. */
export async function expectResponse<T extends z.ZodType>(
  response: APIResponse,
  status: number,
  schema: T,
): Promise<z.infer<T>> {
  expect(response.status(), `unexpected status, body: ${await response.text()}`).toBe(status);
  const result = schema.safeParse(await response.json());
  expect(result.success, result.success ? '' : `schema mismatch: ${result.error.message}`).toBe(true);
  return result.data as z.infer<T>;
}
