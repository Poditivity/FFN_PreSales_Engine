import type { SupabaseClient } from "@supabase/supabase-js";

const BYTES_PER_GB = 1024 ** 3;

/**
 * The free-plan allowances this project runs on: Supabase Free gives 500 MB of
 * database and 1 GB of file storage, Cloudflare R2's free tier gives 10 GB.
 * Neither provider reports its plan limits through an API, so they live here.
 * SUPABASE_DATABASE_LIMIT_GB, SUPABASE_STORAGE_LIMIT_GB and R2_STORAGE_LIMIT_GB
 * still override them, for the day the plan changes.
 */
export const FREE_PLAN_LIMITS_GB = { supabaseDatabase: 0.5, supabaseStorage: 1, r2: 10 } as const;

export interface ProviderDelivery {
  provider: "zeptomail";
  label: string;
  sent: number;
  failed: number;
}

export interface EmailUsage {
  providers: ProviderDelivery[];
  sent: number;
  failed: number;
  /** Sent as a share of all attempts, 0 to 100. Null when nothing has been attempted yet. */
  deliveryPercent: number | null;
  /** Sends so far this month. */
  usedThisMonth: number;
}

export interface SupabaseUsage {
  databaseGb: number;
  storageGb: number;
  databaseLimitGb: number;
  storageLimitGb: number;
}

export function bytesToGb(bytes: number): number {
  return bytes / BYTES_PER_GB;
}

/** GB for the Settings page. A small total keeps three decimals so it does not read as 0.00. */
export function formatGb(gb: number): string {
  return `${gb.toFixed(gb < 0.1 ? 3 : 2)} GB`;
}

export interface R2Usage {
  usedBytes: number;
  objects: number;
  checkedAt: string;
  /** True when the bucket was too large to count in full, so the total is a minimum. */
  truncated: boolean;
  limitGb: number | null;
}

export function percent(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

export function readPositiveNumber(raw: string | undefined): number | null {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n > 0 ? n : null;
}

function startOfMonthUtc(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function countSends(supabase: SupabaseClient, provider: string, status: "sent" | "failed", since: string): Promise<number> {
  const { count } = await supabase
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("provider", provider)
    .eq("status", status)
    .gte("created_at", since);
  return count ?? 0;
}

/**
 * Delivery here means the provider accepted the message. The send log records
 * "sent" or "failed" per attempt; bounces and spam reports arrive later from
 * the provider and are not in this log.
 */
export async function loadEmailUsage(supabase: SupabaseClient, now = new Date()): Promise<EmailUsage> {
  const since = startOfMonthUtc(now);
  const defs = [{ provider: "zeptomail", label: "ZeptoMail" }] as const;

  const providers = await Promise.all(
    defs.map(async (d) => {
      const [sent, failed] = await Promise.all([
        countSends(supabase, d.provider, "sent", since),
        countSends(supabase, d.provider, "failed", since),
      ]);
      return { ...d, sent, failed };
    }),
  );

  const sent = providers.reduce((sum, p) => sum + p.sent, 0);
  const failed = providers.reduce((sum, p) => sum + p.failed, 0);

  return {
    providers,
    sent,
    failed,
    deliveryPercent: percent(sent, sent + failed),
    usedThisMonth: sent,
  };
}

export async function loadSupabaseUsage(supabase: SupabaseClient): Promise<SupabaseUsage | null> {
  const { data, error } = await supabase.rpc("storage_usage").single<{ database_bytes: number; storage_bytes: number }>();
  if (error || !data) return null;
  return {
    databaseGb: bytesToGb(Number(data.database_bytes)),
    storageGb: bytesToGb(Number(data.storage_bytes)),
    databaseLimitGb: readPositiveNumber(process.env.SUPABASE_DATABASE_LIMIT_GB) ?? FREE_PLAN_LIMITS_GB.supabaseDatabase,
    storageLimitGb: readPositiveNumber(process.env.SUPABASE_STORAGE_LIMIT_GB) ?? FREE_PLAN_LIMITS_GB.supabaseStorage,
  };
}
