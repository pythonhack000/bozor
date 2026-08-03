import type { Category } from "./types";

// Fixed, known-at-build-time category catalog. Used only for static route
// generation (generateStaticParams) — the live data (name, image, price
// stats) is fetched from Supabase via getCategories() in db.ts.
export const categories: Category[] = [
  { slug: "pubg-mobile", name: { ru: "", tj: "", en: "" }, image: "", imageFit: "cover", color: "", listingsCount: 0, fromPrice: 0 },
  { slug: "standoff2", name: { ru: "", tj: "", en: "" }, image: "", imageFit: "cover", color: "", listingsCount: 0, fromPrice: 0 },
  { slug: "cs2", name: { ru: "", tj: "", en: "" }, image: "", imageFit: "cover", color: "", listingsCount: 0, fromPrice: 0 },
  { slug: "free-fire", name: { ru: "", tj: "", en: "" }, image: "", imageFit: "cover", color: "", listingsCount: 0, fromPrice: 0 },
  { slug: "mobile-legends", name: { ru: "", tj: "", en: "" }, image: "", imageFit: "cover", color: "", listingsCount: 0, fromPrice: 0 },
  { slug: "steam", name: { ru: "", tj: "", en: "" }, image: "", imageFit: "contain", color: "", listingsCount: 0, fromPrice: 0 },
  { slug: "genshin-impact", name: { ru: "", tj: "", en: "" }, image: "", imageFit: "cover", color: "", listingsCount: 0, fromPrice: 0 },
  { slug: "roblox", name: { ru: "", tj: "", en: "" }, image: "", imageFit: "cover", color: "", listingsCount: 0, fromPrice: 0 },
];

export function getCategory(slug: string) {
  return categories.find((c) => c.slug === slug);
}
