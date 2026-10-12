import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** False while rendering on the server and during hydration, true afterwards. Lets a form pick up the browser's current time without a hydration mismatch. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
