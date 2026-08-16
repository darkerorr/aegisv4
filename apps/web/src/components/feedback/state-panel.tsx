import { CircleX, Inbox, LoaderCircle, TriangleAlert, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";

const icons = { empty: Inbox, error: CircleX, loading: LoaderCircle, offline: Unplug, permission: TriangleAlert };

type StatePanelProps = {
  state: keyof typeof icons;
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function StatePanel({ state, title, message, onRetry, retryLabel = "Try again" }: StatePanelProps) {
  const Icon = icons[state];
  const loading = state === "loading";
  return <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-white/15 p-8 text-center" role="status" aria-live="polite">
    <div>
      <span className="mx-auto grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[.04]">
        <Icon aria-hidden="true" size={22} className={loading ? "animate-spin" : ""} />
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">{message}</p>
      {onRetry && !loading && <Button className="mt-5" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  </div>;
}
