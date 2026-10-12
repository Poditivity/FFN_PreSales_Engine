"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Skeleton } from "@/components/ffn";
import { bytesToGb, FREE_PLAN_LIMITS_GB, formatGb, type R2Usage } from "@/lib/admin/usage";
import { formatIST } from "@/lib/forms/ist";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { readFunctionError } from "@/lib/supabase/functionError";
import { UsageMeter } from "./UsageMeter";

type State =
  | { status: "loading"; usage: R2Usage | null }
  | { status: "ready"; usage: R2Usage }
  | { status: "not_configured" }
  | { status: "error"; message: string; usage: R2Usage | null };

const formatCount = (n: number) => n.toLocaleString("en-US");

/** Asks the r2-usage function for the bucket's size. Keeps the last reading on screen if it fails. */
async function fetchUsage(refresh: boolean, previous: R2Usage | null): Promise<State> {
  const { data, error } = await createBrowserSupabaseClient().functions.invoke("r2-usage", { body: { refresh } });
  if (error) {
    const { message, code } = await readFunctionError(error);
    if (code === "not_configured") return { status: "not_configured" };
    return { status: "error", message: message ?? "Could not read Cloudflare usage.", usage: previous };
  }
  return {
    status: "ready",
    usage: {
      usedBytes: Number(data.usedBytes),
      objects: Number(data.objects),
      checkedAt: data.checkedAt,
      truncated: !!data.truncated,
      limitGb: data.limitGb ?? FREE_PLAN_LIMITS_GB.r2,
    },
  };
}

export function R2UsageCard({ initial }: { initial: R2Usage | null }) {
  const [state, setState] = useState<State>({ status: "loading", usage: initial });

  useEffect(() => {
    // The first read can be a few seconds on a large bucket, so the card draws
    // with the last saved reading and updates when this one returns.
    let cancelled = false;
    fetchUsage(false, initial).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  function refresh() {
    const previous = "usage" in state ? state.usage : null;
    setState({ status: "loading", usage: previous });
    fetchUsage(true, previous).then(setState);
  }

  const usage = state.status === "ready" || state.status === "loading" || state.status === "error" ? state.usage : null;
  const loading = state.status === "loading";

  return (
    <Card
      title="Cloudflare R2"
      subtitle="Files applicants upload to forms, and founder and mentor photos."
      actions={
        state.status === "not_configured" ? (
          <Badge tone="neutral">Not connected</Badge>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Refresh Cloudflare usage"
            onClick={refresh}
            disabled={loading}
            iconLeft={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
        )
      }
    >
      <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
        {state.status === "not_configured" ? (
          <Alert tone="warning" title="Cloudflare R2 is not connected">
            Set the R2 secrets on your Supabase functions, then refresh. Your real usage in GB appears here.
          </Alert>
        ) : usage ? (
          <>
            <UsageMeter label="Storage" used={bytesToGb(usage.usedBytes)} limit={usage.limitGb} format={formatGb} />
            <p className="body-sm" style={{ color: "var(--ink-muted)" }}>
              {formatCount(usage.objects)} {usage.objects === 1 ? "file" : "files"}
              {usage.truncated ? ", counted up to the first 200,000" : ""}. Checked {formatIST(usage.checkedAt)}.
            </p>
          </>
        ) : loading ? (
          <div className="flex flex-col" style={{ gap: "var(--space-3)" }} role="status" aria-busy="true">
            <span className="ffn-sr">Loading Cloudflare usage</span>
            <Skeleton width="100%" height="var(--space-4)" />
            <Skeleton width="100%" height="var(--space-2)" />
            <Skeleton width="60%" height="var(--space-3)" />
          </div>
        ) : null}

        {state.status === "error" && (
          <Alert tone="danger" title="Usage is not available">
            {state.message}
          </Alert>
        )}
      </div>
    </Card>
  );
}
