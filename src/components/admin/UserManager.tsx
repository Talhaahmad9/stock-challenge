"use client";

import { useState } from "react";
import Spinner from "@/components/shared/Spinner";
import { useModal } from "@/hooks/useModal";

interface UserRow {
  id: string;
  username: string;
  is_active: boolean;
}

interface Props {
  users: UserRow[];
  onRefresh: () => void;
}

export default function UserManager({ users, onRefresh }: Props) {
  const { alert, confirm, ModalRenderer } = useModal();
  const [count, setCount] = useState("");
  const [prefix, setPrefix] = useState("player");
  const [generated, setGenerated] = useState<
    { username: string; password: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  // track which user row is mid-request: "reset:{id}" | "toggle:{id}"
  const [rowLoading, setRowLoading] = useState<string | null>(null);

  async function handleGenerate() {
    const n = parseInt(count, 10);
    if (!n || n <= 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GENERATE", count: n, prefix }),
      });
      const data = (await res.json()) as {
        created: { username: string; password: string }[];
      };
      setGenerated(data.created ?? []);
      onRefresh();
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(userId: string) {
    setRowLoading(`reset:${userId}`);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_PASSWORD", userId }),
      });
      const data = (await res.json()) as { newPassword?: string; error?: string };
      if (data.newPassword) {
        alert({
          title: "PASSWORD RESET",
          message: `New password: ${data.newPassword}`,
          confirmLabel: "OK",
        });
      } else {
        alert({
          title: "ERROR",
          message: data.error ?? "Failed to reset password",
          confirmLabel: "OK",
        });
      }
    } catch {
      /* silent */
    } finally {
      setRowLoading(null);
    }
  }

  function promptToggleActive(userId: string, isActive: boolean) {
    if (isActive) {
      confirm({
        title: "DISABLE USER",
        message: "This user will no longer be able to log in.",
        confirmLabel: "DISABLE",
        variant: "danger",
        onConfirm: () => void doToggleActive(userId, isActive),
      });
    } else {
      void doToggleActive(userId, isActive);
    }
  }

  async function doToggleActive(userId: string, isActive: boolean) {
    setRowLoading(`toggle:${userId}`);
    try {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOGGLE_ACTIVE",
          userId,
          isActive: !isActive,
        }),
      });
      onRefresh();
    } catch {
      /* silent */
    } finally {
      setRowLoading(null);
    }
  }

  function copyCSV() {
    const csv = [
      "username,password",
      ...generated.map((u) => `${u.username},${u.password}`),
    ].join("\n");
    navigator.clipboard.writeText(csv).catch(console.error);
  }

  const inp =
    "w-full bg-black border border-green-500/30 text-green-300 placeholder-green-900 rounded px-3 py-2 text-sm focus:border-green-400 focus:outline-none";

  return (
    <>
      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-4">
        <p className="text-xs uppercase tracking-widest text-green-700">
          Generate Participants
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-green-700 uppercase tracking-widest">
              Count
            </label>
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="10"
              className={inp}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-green-700 uppercase tracking-widest">
              Prefix
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="player"
              className={inp}
            />
          </div>
        </div>
        <button
          onClick={() => void handleGenerate()}
          disabled={loading || !count}
          className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? <Spinner size="sm" /> : "GENERATE"}
        </button>

        {generated.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-green-700 tracking-widest uppercase">
                {generated.length} users created
              </p>
              <button
                onClick={copyCSV}
                className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-1 rounded tracking-widest uppercase"
              >
                COPY CSV
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-green-500/10 rounded">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-green-500/10">
                    <th className="text-left px-3 py-2 text-green-700 tracking-widest uppercase">
                      Username
                    </th>
                    <th className="text-left px-3 py-2 text-green-700 tracking-widest uppercase">
                      Password
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {generated.map((u) => (
                    <tr
                      key={u.username}
                      className="border-b border-green-500/5"
                    >
                      <td className="px-3 py-1 text-green-400">{u.username}</td>
                      <td className="px-3 py-1 text-green-300">{u.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-green-700">
            Participants
          </p>
          <span className="text-xs text-green-700 tracking-widest">
            {users.length} TOTAL
          </span>
        </div>
        {users.length === 0 ? (
          <p className="text-xs text-green-900 text-center py-6 tracking-widest">
            NO PARTICIPANTS
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-green-500/10">
                  <th className="text-left px-2 py-2 text-green-700 tracking-widest uppercase">
                    Username
                  </th>
                  <th className="text-left px-2 py-2 text-green-700 tracking-widest uppercase">
                    Status
                  </th>
                  <th className="text-right px-2 py-2 text-green-700 tracking-widest uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-green-500/5">
                    <td className="px-2 py-2 text-green-300">{u.username}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`flex items-center gap-1 ${u.is_active ? "text-green-400" : "text-red-400"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-green-400" : "bg-red-500"}`}
                        />
                        {u.is_active ? "ACTIVE" : "DISABLED"}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => void handleResetPassword(u.id)}
                          disabled={rowLoading !== null}
                          className="border border-green-500/30 text-green-700 hover:text-green-400 hover:border-green-400 text-xs px-2 py-1 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {rowLoading === `reset:${u.id}` ? (
                            <Spinner size="sm" />
                          ) : (
                            "RESET PWD"
                          )}
                        </button>
                        <button
                          onClick={() => promptToggleActive(u.id, u.is_active)}
                          disabled={rowLoading !== null}
                          className={`text-xs px-2 py-1 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed ${
                            u.is_active
                              ? "border border-red-500/50 text-red-400 hover:bg-red-500/10"
                              : "border border-green-500/30 text-green-400 hover:bg-green-500/10"
                          }`}
                        >
                          {rowLoading === `toggle:${u.id}` ? (
                            <Spinner size="sm" />
                          ) : u.is_active ? (
                            "DISABLE"
                          ) : (
                            "ENABLE"
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ModalRenderer />
    </>
  );
}
