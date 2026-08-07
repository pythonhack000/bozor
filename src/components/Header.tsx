"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, MessageCircle, Menu, X, LayoutGrid, ChevronDown, Plus, LogOut, Wallet, Package, Store, ShieldAlert, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useCategories } from "@/lib/categories-context";
import { useWallet } from "@/lib/wallet-context";
import { CategoryImage } from "./CategoryImage";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Avatar } from "./Avatar";
import { TopUpModal } from "./TopUpModal";

export function Header() {
  const { t, tl } = useI18n();
  const { user, logout } = useAuth();
  const { categories } = useCategories();
  const { balance } = useWallet();
  const [catOpen, setCatOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 text-lg font-bold">
          <span className="text-foreground">Acc</span>
          <span className="text-brand">Bozor</span>
        </Link>

        <div className="relative hidden lg:block" ref={catRef}>
          <button
            onClick={() => setCatOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/90 transition hover:border-brand/40"
          >
            <LayoutGrid size={16} />
            {t("nav.categories")}
            <ChevronDown size={14} className={`transition ${catOpen ? "rotate-180" : ""}`} />
          </button>
          {catOpen && (
            <div className="absolute left-0 z-30 mt-1.5 grid w-[560px] animate-fade-in-up grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-3 shadow-2xl">
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/catalog/${c.slug}`}
                  onClick={() => setCatOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground/90 hover:bg-surface"
                >
                  <CategoryImage category={c} size={32} />
                  {tl(c.name)}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="hidden flex-1 items-center md:flex">
          <div className="relative w-full max-w-md">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder={t("common.searchPlaceholder")}
              className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-muted focus:border-brand/50 focus:outline-none"
            />
          </div>
        </div>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          <Link
            href="/messages"
            className="rounded-lg p-2 text-muted transition hover:bg-surface hover:text-foreground"
            aria-label={t("common.messages")}
          >
            <MessageCircle size={19} />
          </Link>
          <LanguageSwitcher />
          {user ? (
            <>
              <button
                onClick={() => setTopUpOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/90 transition hover:border-brand/40"
              >
                <Wallet size={15} className="text-brand" />
                {balance} {t("common.currency")}
              </button>
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-surface"
                >
                  <Avatar name={user.name} size={28} />
                  <span className="max-w-[100px] truncate text-sm font-medium text-foreground/90">
                    {user.name}
                  </span>
                  <ChevronDown size={13} className={`text-muted transition ${userOpen ? "rotate-180" : ""}`} />
                </button>
                {userOpen && (
                  <div className="absolute right-0 z-30 mt-1.5 w-52 animate-fade-in-up overflow-hidden rounded-lg border border-border bg-surface-2 py-1 shadow-xl">
                    <Link
                      href="/profile"
                      onClick={() => setUserOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground/90 hover:bg-surface"
                    >
                      <UserRound size={14} />
                      {t("nav.profile")}
                    </Link>
                    <Link
                      href={`/seller?id=${user.id}`}
                      onClick={() => setUserOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground/90 hover:bg-surface"
                    >
                      <Store size={14} />
                      {t("nav.myListings")}
                    </Link>
                    <Link
                      href="/orders"
                      onClick={() => setUserOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground/90 hover:bg-surface"
                    >
                      <Package size={14} />
                      {t("nav.myOrders")}
                    </Link>
                    {user.isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setUserOpen(false)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground/90 hover:bg-surface"
                      >
                        <ShieldAlert size={14} />
                        {t("admin.title")}
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        logout();
                        setUserOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground/90 hover:bg-surface"
                    >
                      <LogOut size={14} />
                      {t("common.logout")}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              href="/auth"
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/90 transition hover:bg-surface"
            >
              {t("common.login")}
            </Link>
          )}
          <Link
            href="/sell"
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark"
          >
            <Plus size={16} />
            {t("common.sell")}
          </Link>
        </nav>

        <button
          className="ml-auto rounded-lg p-2 text-foreground lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border px-4 py-3 lg:hidden">
          <div className="relative mb-3">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder={t("common.searchPlaceholder")}
              className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-muted focus:border-brand/50 focus:outline-none"
            />
          </div>
          <div className="mb-3 grid grid-cols-2 gap-1">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/catalog/${c.slug}`}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground/90 hover:bg-surface"
              >
                <CategoryImage category={c} size={26} />
                {tl(c.name)}
              </Link>
            ))}
          </div>
          {user && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setTopUpOpen(true);
                  setMobileOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/90"
              >
                <Wallet size={14} className="text-brand" />
                {balance} {t("common.currency")}
              </button>
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground/90"
              >
                <UserRound size={14} />
                {t("nav.profile")}
              </Link>
              <Link
                href={`/seller?id=${user.id}`}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground/90"
              >
                <Store size={14} />
                {t("nav.myListings")}
              </Link>
              <Link
                href="/orders"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground/90"
              >
                <Package size={14} />
                {t("nav.myOrders")}
              </Link>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Link
              href="/messages"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground/90"
            >
              <MessageCircle size={16} />
              {t("common.messages")}
            </Link>
            {user ? (
              <button
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground/90"
              >
                <LogOut size={14} />
                {t("common.logout")}
              </button>
            ) : (
              <Link
                href="/auth"
                onClick={() => setMobileOpen(false)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-sm text-foreground/90"
              >
                {t("common.login")}
              </Link>
            )}
            <Link
              href="/sell"
              onClick={() => setMobileOpen(false)}
              className="flex-1 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-brand-foreground"
            >
              {t("common.sell")}
            </Link>
          </div>
          <div className="mt-3">
            <LanguageSwitcher />
          </div>
        </div>
      )}

      {topUpOpen && <TopUpModal onClose={() => setTopUpOpen(false)} />}
    </header>
  );
}
