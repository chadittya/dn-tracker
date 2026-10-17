export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
    >
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md px-2 py-0.5 font-semibold hover:bg-rose-200/60 dark:hover:bg-rose-900"
        aria-label="Dismiss error"
      >
        Dismiss
      </button>
    </div>
  );
}
