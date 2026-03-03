import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

type Role = "admin" | "participant" | "any";

/**
 * Handles auth on page load:
 * 1. Calls fetchMe() to rehydrate user from the httpOnly cookie
 * 2. Redirects to /login if not authenticated
 * 3. Redirects to /trade if role doesn't match (e.g. participant hits /admin)
 *
 * Returns { ready } — render nothing until ready is true to avoid flash.
 */
export function useAuth(requiredRole: Role = "any") {
  const router = useRouter();
  const { user, fetchMe } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function check() {
      // If store already has user (e.g. navigated client-side), skip fetchMe
      if (!user) await fetchMe();

      const currentUser = useAuthStore.getState().user;

      if (!currentUser) {
        router.replace("/login");
        return;
      }

      if (requiredRole === "admin" && currentUser.role !== "admin") {
        router.replace("/trade");
        return;
      }

      setReady(true);
    }

    void check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { ready, user: useAuthStore.getState().user };
}
