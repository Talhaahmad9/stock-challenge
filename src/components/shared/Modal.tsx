"use client";

import { useEffect, useRef } from "react";

export interface ModalProps {
  type: "alert" | "confirm";
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function Modal({
  type,
  title,
  message,
  confirmLabel = "CONFIRM",
  cancelLabel = "CANCEL",
  variant = "default",
  onConfirm,
  onCancel,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button on mount
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (type === "confirm") onCancel?.();
        else onConfirm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [type, onConfirm, onCancel]);

  // Trap focus inside the dialog
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        el!.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => !n.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    el.addEventListener("keydown", onTab);
    return () => el.removeEventListener("keydown", onTab);
  }, []);

  const confirmBtnCls =
    variant === "danger"
      ? "border border-red-500/50 text-red-400 hover:bg-red-500/10 focus:ring-red-500/50"
      : "border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 focus:ring-green-500/50";

  return (
    // Backdrop — click outside cancels (confirm) or closes (alert)
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80"
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
      aria-describedby="modal-message"
      onClick={() => {
        if (type === "confirm") onCancel?.();
        else onConfirm();
      }}
    >
      {/* Panel — stop propagation so clicks inside don't close */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-sm bg-[#0a0a0a] border border-green-500/20 rounded-md p-6 space-y-5 font-mono shadow-[0_0_40px_rgba(0,255,65,0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative top accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-500/40 to-transparent rounded-t-md" />

        {/* Title */}
        <div className="space-y-1.5">
          <p
            id="modal-title"
            className={`text-xs tracking-widest uppercase font-bold ${
              variant === "danger" ? "text-red-400" : "text-green-700"
            }`}
          >
            {variant === "danger" ? "⚠ " : ""}
            {title}
          </p>
          <p
            id="modal-message"
            className="text-sm text-green-300 leading-relaxed"
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {type === "confirm" && (
            <button
              onClick={onCancel}
              className="border border-green-500/20 text-green-700 hover:text-green-400 hover:border-green-500/40 text-xs px-4 py-2 rounded tracking-widest uppercase transition-colors focus:outline-none focus:ring-1 focus:ring-green-500/50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`text-xs px-4 py-2 rounded tracking-widest uppercase transition-colors focus:outline-none focus:ring-1 ${confirmBtnCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
