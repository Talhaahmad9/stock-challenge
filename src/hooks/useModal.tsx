"use client";

import { useState, useCallback } from "react";
import Modal, { type ModalProps } from "@/components/shared/Modal";

// ─── Public option types ──────────────────────────────────────────────────────

/** Options for alert() — no onConfirm needed; modal closes itself */
type AlertOptions = Omit<ModalProps, "type" | "onConfirm" | "onCancel"> & {
  /** Called after the user dismisses the alert */
  onClose?: () => void;
};

/** Options for confirm() — onConfirm is required */
type ConfirmOptions = Omit<ModalProps, "type" | "onConfirm"> & {
  onConfirm: () => void;
};

type ModalState = ModalProps | null;

/**
 * useModal
 *
 * Drop-in replacement for window.alert / window.confirm.
 * Returns { alert, confirm, ModalRenderer }.
 *
 * Render <ModalRenderer /> at the bottom of the JSX that uses this hook.
 * Only one modal is shown at a time.
 *
 * @example
 *   const { alert, confirm, ModalRenderer } = useModal()
 *
 *   // Info/success alert
 *   alert({ title: "DONE", message: `New password: ${pw}` })
 *
 *   // Destructive confirmation
 *   confirm({
 *     title: "DELETE STOCK",
 *     message: "This cannot be undone.",
 *     variant: "danger",
 *     onConfirm: () => void handleDelete(id),
 *   })
 *
 *   return (
 *     <>
 *       ...your UI...
 *       <ModalRenderer />
 *     </>
 *   )
 */
export function useModal() {
  const [state, setState] = useState<ModalState>(null);

  const close = useCallback(() => setState(null), []);

  /** Show an info/success/error alert with a single OK button */
  const alert = useCallback(
    (opts: AlertOptions) => {
      const { onClose, ...rest } = opts;
      setState({
        type: "alert",
        confirmLabel: rest.confirmLabel ?? "OK",
        ...rest,
        onConfirm: () => {
          close();
          onClose?.();
        },
      });
    },
    [close],
  );

  /** Show a confirmation dialog with CONFIRM + CANCEL */
  const confirm = useCallback(
    (opts: ConfirmOptions) => {
      const { onConfirm, onCancel, ...rest } = opts;
      setState({
        type: "confirm",
        ...rest,
        onConfirm: () => {
          close();
          onConfirm();
        },
        onCancel: () => {
          close();
          onCancel?.();
        },
      });
    },
    [close],
  );

  /**
   * Render this component at the bottom of the JSX tree in whatever
   * component calls useModal(). Returns null when no modal is active.
   */
  function ModalRenderer() {
    if (!state) return null;
    return <Modal {...state} />;
  }

  return { alert, confirm, ModalRenderer };
}
