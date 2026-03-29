"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function RootPage() {
  const router = useRouter();
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    async function redirect() {
      await fetchMe();
      const user = useAuthStore.getState().user;
      if (!user) router.replace("/login");
      else if (user.role === "admin") router.replace("/admin");
      else router.replace("/trade");
    }
    void redirect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-mono">
      <div className="flex flex-col items-center gap-4">
        <p className="text-green-400 text-sm tracking-widest uppercase animate-pulse">
          MARKET MAYHEM
        </p>
        <div className="flex items-end gap-1">
          {[2, 4, 3, 5, 2, 4, 3].map((h, i) => (
            <span
              key={i}
              className="w-1 bg-green-400 rounded-sm animate-pulse"
              style={{ height: `${h * 4}px`, animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
