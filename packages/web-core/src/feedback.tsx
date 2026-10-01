'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

/*
 * In-app feedback for the dashboards: toasts, confirm/prompt dialogs and a small action hook.
 * Replaces window.alert/confirm/prompt, which block the tab, look foreign and give no success signal.
 */

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions extends ConfirmOptions {
  label: string;
  placeholder?: string;
  initial?: string;
  minLength?: number;
  multiline?: boolean;
}

type Dialog =
  | { type: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { type: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

interface FeedbackApi {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

const TOAST_MS = 3500;

const TOAST_STYLE: Record<ToastKind, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-900 text-white',
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ type: 'confirm', options, resolve })),
    [],
  );
  const prompt = useCallback(
    (options: PromptOptions) => new Promise<string | null>((resolve) => setDialog({ type: 'prompt', options, resolve })),
    [],
  );

  const api = useMemo(() => ({ toast, confirm, prompt }), [toast, confirm, prompt]);

  const close = (result: boolean | string | null) => {
    if (!dialog) return;
    if (dialog.type === 'confirm') dialog.resolve(result === true);
    else dialog.resolve(typeof result === 'string' ? result : null);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`pointer-events-auto rounded-xl px-4 py-2 text-sm font-semibold shadow-lg ${TOAST_STYLE[t.kind]}`}>
            {t.message}
          </div>
        ))}
      </div>
      {dialog && <DialogView dialog={dialog} onClose={close} />}
    </FeedbackContext.Provider>
  );
}

function DialogView({ dialog, onClose }: { dialog: Dialog; onClose: (result: boolean | string | null) => void }) {
  const { options } = dialog;
  const isPrompt = dialog.type === 'prompt';
  const promptOptions = isPrompt ? (options as PromptOptions) : null;
  const [value, setValue] = useState(promptOptions?.initial ?? '');
  const minLength = promptOptions?.minLength ?? 0;
  const valid = !isPrompt || value.trim().length >= minLength;
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onClose(isPrompt ? value.trim() : true);
  };

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => onClose(null)}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id="dialog-title" className="text-base font-bold text-slate-900">
          {options.title}
        </h2>
        {options.body && <div className="mt-2 text-sm text-slate-600">{options.body}</div>}
        {promptOptions && (
          <label className="mt-3 block text-xs font-semibold text-slate-600">
            {promptOptions.label}
            {promptOptions.multiline ? (
              <textarea ref={inputRef} rows={3} value={value} placeholder={promptOptions.placeholder} onChange={(e) => setValue(e.target.value)} className={inputClass} />
            ) : (
              <input ref={inputRef} value={value} placeholder={promptOptions.placeholder} onChange={(e) => setValue(e.target.value)} className={inputClass} />
            )}
            {minLength > 0 && value.trim().length < minLength && (
              <span className="mt-1 block text-[11px] font-normal text-slate-400">At least {minLength} characters.</span>
            )}
          </label>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onClose(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={!valid}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${options.danger ? 'bg-red-600' : 'bg-slate-900'}`}
          >
            {options.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return ctx;
}

interface ActionOptions {
  /** Toast shown when the action resolves. A function can describe the result. */
  success?: string | ((result: unknown) => string);
  /** Called with the error instead of showing a toast when it returns true. */
  onError?: (error: Error) => boolean | void;
}

/**
 * Wraps an async handler with a busy flag and error toast so buttons disable and failures are visible.
 * Returns the handler result, or undefined when it failed.
 */
export function useAction<A extends unknown[], R>(handler: (...args: A) => Promise<R>, options: ActionOptions = {}) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setBusy(true);
      try {
        const result = await handler(...args);
        const message = typeof options.success === 'function' ? options.success(result) : options.success;
        if (message) toast(message, 'success'); // an empty string means "nothing to announce" (e.g. cancelled dialog)
        return result;
      } catch (err) {
        const error = err as Error;
        if (!options.onError?.(error)) toast(error.message || 'Something went wrong', 'error');
        return undefined;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handler, options.success, options.onError, toast],
  );

  return [run, busy] as const;
}
