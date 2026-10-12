import { Suspense } from "react";
import { HubSkeleton } from "@/components/ffn/PublicSkeletons";
import { HubRenderer } from "./HubRenderer";

export default async function HubPage({ params }: PageProps<"/hub/[token]">) {
  const { token } = await params;
  return (
    <Suspense fallback={<HubSkeleton />}>
      <HubRenderer token={token} />
    </Suspense>
  );
}
