/**
 * supabase-js hides the JSON body of a non-2xx edge function reply inside
 * error.context (a Response). This reads it back, so the page can show the
 * message and code the function chose rather than a generic failure.
 */
export async function readFunctionError(error: unknown): Promise<{ message: string | null; code: string | null }> {
  const context = (error as { context?: Response } | null)?.context;
  if (!context || typeof context.json !== "function") return { message: null, code: null };
  const body = await context.json().catch(() => null);
  return {
    message: typeof body?.error === "string" ? body.error : null,
    code: typeof body?.code === "string" ? body.code : null,
  };
}
