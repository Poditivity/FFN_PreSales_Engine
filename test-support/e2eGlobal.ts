// Playwright globalSetup. Clears any leftovers from an interrupted earlier run,
// creates the smoke-test form the specs submit to, and returns the teardown that
// clears this run's data and removes the form once every spec has finished. Does nothing when there is no service-role key
// (the specs that need one skip themselves in that case anyway).
import { cleanUpE2eData, ensureSmokeForm, removeSmokeForm } from "./e2eData";

async function safely(what: string, step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch (error) {
    // Never fail the run over housekeeping. Say so loudly instead.
    console.warn(`e2e ${what} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default async function globalSetup(): Promise<(() => Promise<void>) | undefined> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return undefined;
  await safely("cleanup before run", cleanUpE2eData);
  await safely("smoke-test form setup", ensureSmokeForm);
  return async () => {
    await safely("cleanup after run", cleanUpE2eData);
    await safely("smoke-test form removal", removeSmokeForm);
  };
}
