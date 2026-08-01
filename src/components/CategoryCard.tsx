"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Category } from "@/lib/types";
import { useI18n } from "@/lib/i18n-context";
import { CategoryImage } from "./CategoryImage";

export function CategoryCard({ category }: { category: Category }) {
  const { t, tl } = useI18n();
  return (
    <Link
      href={`/catalog/${category.slug}`}
      className="group flex items-center gap-3.5 rounded-lg border border-border bg-surface p-4 transition hover:border-brand/40 hover:bg-surface-2"
    >
      <CategoryImage category={category} size={44} />
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{tl(category.name)}</span>
        <span className="block text-xs text-muted">
          {category.listingsCount} · {t("common.from")} {category.fromPrice} {t("common.currency")}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
    </Link>
  );
}
