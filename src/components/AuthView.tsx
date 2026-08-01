"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Headset, BadgeCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";

export function AuthView() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = mode === "register" && name ? name : email.split("@")[0] || email;
    login(displayName || "Пользователь");
    router.push(searchParams.get("next") || "/");
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-5xl grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-border bg-surface p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="relative flex items-center gap-1.5 text-xl font-bold">
          <span className="text-foreground">Acc</span>
          <span className="text-brand">Bozor</span>
        </div>
        <div className="relative space-y-5">
          {[
            { icon: ShieldCheck, key: "home.trustGuaranteeTitle" },
            { icon: BadgeCheck, key: "home.trustSellersTitle" },
            { icon: Headset, key: "home.trustSupportTitle" },
          ].map(({ icon: Icon, key }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon size={18} />
              </span>
              <span className="text-sm text-foreground/90">{t(key)}</span>
            </div>
          ))}
        </div>
        <p className="relative text-xs text-muted">{t("common.tagline")}</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex rounded-lg border border-border bg-surface p-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === "login" ? "bg-brand text-brand-foreground" : "text-muted"
              }`}
            >
              {t("common.login")}
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === "register" ? "bg-brand text-brand-foreground" : "text-muted"
              }`}
            >
              {t("common.register")}
            </button>
          </div>

          <h1 className="mb-1 text-xl font-bold text-foreground">
            {mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
          </h1>
          {searchParams.get("next") && (
            <p className="mb-4 text-xs text-muted">{t("auth.loginRequired")}</p>
          )}
          {!searchParams.get("next") && <div className="mb-5" />}

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("auth.nameLabel")}</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">{t("auth.emailLabel")}</label>
              <input
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">{t("auth.passwordLabel")}</label>
              <input
                type="password"
                required
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
              />
            </div>
            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  {t("auth.confirmPasswordLabel")}
                </label>
                <input
                  type="password"
                  required
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark"
            >
              {mode === "login" ? t("auth.loginButton") : t("auth.registerButton")}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-medium text-brand hover:underline"
            >
              {mode === "login" ? t("auth.switchToRegister") : t("auth.switchToLogin")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
