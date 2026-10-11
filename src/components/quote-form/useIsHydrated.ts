import { useSyncExternalStore } from "react";

function subscribeToNothing(): () => void {
  return () => undefined;
}

/**
 * False in the static HTML and while React hydrates it, true once the page's
 * script is running. The form keeps Send disabled until then, so the static
 * HTML form can never be submitted by the browser on its own.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}
