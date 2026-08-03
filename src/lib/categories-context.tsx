"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Category } from "./types";
import { getCategories } from "./db";

interface CategoriesContextValue {
  categories: Category[];
  isLoading: boolean;
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((err) => console.error("Failed to load categories", err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <CategoriesContext.Provider value={{ categories, isLoading }}>{children}</CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used within CategoriesProvider");
  return ctx;
}
