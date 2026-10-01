"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "apps/admin-ui/src/utils/axioInstance";
import { Activity, Check, LoaderCircle, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import Breadcrumbs from "../../shared/component/breadcrumbs";

const GROUPS = [
  {
    title: "Authentication",
    actions: [
      { key: "userLogin", label: "User login", description: "Successful sign-ins" },
      { key: "userRegistration", label: "User registration", description: "New account creation" },
      { key: "userLogout", label: "User logout", description: "Sign-outs" },
      { key: "passwordChange", label: "Password change", description: "Password updates" },
      { key: "passwordReset", label: "Password reset", description: "Password recovery requests" },
    ],
  },
  {
    title: "Products",
    actions: [
      { key: "productView", label: "Product views", description: "Product detail views" },
      { key: "productSearch", label: "Product searches", description: "Search queries" },
      { key: "productFilter", label: "Product filters", description: "Applied catalog filters" },
      { key: "addToCart", label: "Add to cart", description: "Items added to cart" },
      { key: "addToWishlist", label: "Add to wishlist", description: "Items saved to a wishlist" },
    ],
  },
  {
    title: "Orders & Payments",
    actions: [
      { key: "orderCreated", label: "Order created", description: "New order submissions" },
      { key: "orderCancelled", label: "Order cancelled", description: "Order cancellations" },
      { key: "paymentAttempt", label: "Payment attempts", description: "Payment starts" },
      { key: "paymentSuccess", label: "Payment success", description: "Successful payments" },
      { key: "paymentFailed", label: "Payment failures", description: "Declined or failed payments" },
      { key: "couponUsed", label: "Coupon used", description: "Applied discount codes" },
    ],
  },
  {
    title: "Seller Activity",
    actions: [
      { key: "sellerLogin", label: "Seller login", description: "Successful seller sign-ins" },
      { key: "sellerRegistration", label: "Seller registration", description: "New seller accounts" },
      { key: "shopCreated", label: "Shop created", description: "New shop creation" },
      { key: "productCreated", label: "Product created", description: "Seller product listings" },
      { key: "productDeleted", label: "Product deleted", description: "Seller product removals" },
      { key: "orderStatusChange", label: "Order status changed", description: "Seller order updates" },
    ],
  },
  {
    title: "System & Infrastructure",
    actions: [
      { key: "apiErrors", label: "API errors", description: "Application request errors" },
      { key: "rateLimitHit", label: "Rate limits", description: "Rate-limit events" },
      { key: "webhookEvents", label: "Webhook events", description: "Incoming webhook activity" },
    ],
  },
] as const;

type ActionKey = (typeof GROUPS)[number]["actions"][number]["key"];
type LogConfig = Record<ActionKey, boolean>;

const ACTION_KEYS = GROUPS.flatMap((group) =>
  group.actions.map((action) => action.key),
) as ActionKey[];

const fetchLogConfig = async (): Promise<LogConfig> => {
  const response = await axiosInstance.get("/admin/log-config");
  return response.data.config as LogConfig;
};

const updateLogConfig = async (config: LogConfig): Promise<LogConfig> => {
  const response = await axiosInstance.patch("/admin/update-log-config", config);
  return response.data.config as LogConfig;
};

const LogSettingsPage = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<LogConfig | null>(null);

  const configQuery = useQuery({
    queryKey: ["log-config"],
    queryFn: fetchLogConfig,
  });

  useEffect(() => {
    if (configQuery.data) {
      setDraft((current) => current ?? configQuery.data);
    }
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: updateLogConfig,
    onSuccess: (updated) => {
      setDraft(updated);
      queryClient.setQueryData(["log-config"], updated);
    },
  });

  const config = draft ?? configQuery.data;
  const enabledCount = config
    ? ACTION_KEYS.filter((key) => config[key]).length
    : 0;
  const hasChanges = Boolean(
    config &&
      configQuery.data &&
      ACTION_KEYS.some((key) => config[key] !== configQuery.data[key]),
  );

  const setAll = (enabled: boolean) => {
    setDraft(
      Object.fromEntries(ACTION_KEYS.map((key) => [key, enabled])) as LogConfig,
    );
  };

  return (
    <main className="min-h-screen w-full p-6 text-white md:p-8">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Log Settings" },
        ]}
      />

      <header className="mt-6 flex flex-col gap-5 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <Activity size={19} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Behavior Log Settings</h1>
            <p className="mt-1 text-sm text-slate-400">
              {config ? `${enabledCount} of ${ACTION_KEYS.length} behaviors enabled` : "Choose which events are recorded"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAll(true)}
            disabled={!config || saveMutation.isPending}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enable all
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            disabled={!config || saveMutation.isPending}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Disable all
          </button>
          <button
            type="button"
            onClick={() => configQuery.data && setDraft(configQuery.data)}
            disabled={!hasChanges || saveMutation.isPending}
            aria-label="Discard changes"
            title="Discard changes"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            onClick={() => config && saveMutation.mutate(config)}
            disabled={!hasChanges || saveMutation.isPending}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveMutation.isPending ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : saveMutation.isSuccess && !hasChanges ? (
              <Check size={15} />
            ) : (
              <Save size={15} />
            )}
            {saveMutation.isPending
              ? "Saving..."
              : saveMutation.isSuccess && !hasChanges
                ? "Saved"
                : "Save changes"}
          </button>
        </div>
      </header>

      {configQuery.isLoading ? (
        <div className="space-y-5 py-8" aria-label="Loading log settings">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-md bg-slate-900" />
          ))}
        </div>
      ) : configQuery.isError ? (
        <div className="flex items-center justify-between gap-4 py-8 text-sm text-red-300">
          <span>
            {configQuery.error instanceof Error
              ? configQuery.error.message
              : "Could not load log settings."}
          </span>
          <button
            type="button"
            onClick={() => configQuery.refetch()}
            className="rounded-md border border-red-400/30 px-3 py-2 hover:bg-red-400/10"
          >
            Retry
          </button>
        </div>
      ) : config ? (
        <div className="divide-y divide-slate-800">
          {GROUPS.map((group) => {
            const groupEnabled = group.actions.filter(
              (action) => config[action.key],
            ).length;

            return (
              <section key={group.title} className="py-6">
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  <h2 className="text-base font-semibold text-slate-100">
                    {group.title}
                  </h2>
                  <span className="text-xs tabular-nums text-slate-500">
                    {groupEnabled}/{group.actions.length} enabled
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
                  {group.actions.map((action) => (
                    <label
                      key={action.key}
                      className="flex min-h-16 cursor-pointer items-center justify-between gap-4 border-t border-slate-800/70 py-3 first:border-0 sm:nth-[2]:border-0 xl:nth-[3]:border-0"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-200">
                          {action.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {action.description}
                        </span>
                      </span>
                      <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
                        <input
                          type="checkbox"
                          checked={config[action.key]}
                          disabled={saveMutation.isPending}
                          onChange={(event) =>
                            setDraft({
                              ...config,
                              [action.key]: event.target.checked,
                            })
                          }
                          aria-label={`Record ${action.label.toLowerCase()}`}
                          className="peer sr-only"
                        />
                        <span className="absolute inset-0 rounded-full bg-slate-700 transition peer-checked:bg-emerald-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-400 peer-disabled:opacity-50" />
                        <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {saveMutation.isError && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {saveMutation.error instanceof Error
            ? saveMutation.error.message
            : "Could not save log settings."}
        </p>
      )}
    </main>
  );
};

export default LogSettingsPage;