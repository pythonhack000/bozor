import { supabase } from "./supabase";
import type { Category, DeliveryType, Listing, LocalizedText, Review, Seller } from "./types";

export interface ListingWithRelations extends Listing {
  category: Category;
  seller: Seller;
}

function formatResponseTime(minutes: number): LocalizedText {
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return { ru: `${hours} ч.`, tj: `${hours} соат`, en: `${hours}h` };
  }
  return { ru: `${minutes} минут`, tj: `${minutes} дақиқа`, en: `${minutes} minutes` };
}

function mapCategoryRow(row: Record<string, unknown>, stats?: { count: number; minPrice: number }): Category {
  return {
    slug: row.slug as string,
    name: row.name as LocalizedText,
    image: row.image as string,
    imageFit: row.image_fit as "cover" | "contain",
    color: row.color as string,
    listingsCount: stats?.count ?? 0,
    fromPrice: stats && stats.minPrice !== Infinity ? stats.minPrice : 0,
  };
}

function mapSellerRow(row: Record<string, unknown>): Seller {
  return {
    id: row.id as string,
    name: row.name as string,
    online: Boolean(row.online),
    verified: Boolean(row.verified),
    registeredYear: new Date(row.created_at as string).getFullYear(),
    rating: Number(row.rating),
    reviewsCount: row.reviews_count as number,
    salesCount: row.sales_count as number,
    responseTime: formatResponseTime(row.response_time_minutes as number),
    city: (row.city as string) ?? "",
  };
}

function mapListingRow(row: Record<string, unknown>): Listing {
  return {
    id: row.id as string,
    categorySlug: row.category_slug as string,
    title: row.title as LocalizedText,
    description: row.description as LocalizedText,
    price: Number(row.price),
    oldPrice: row.old_price != null ? Number(row.old_price) : undefined,
    sellerId: row.seller_id as string,
    delivery: row.delivery as DeliveryType,
    server: (row.server as string) ?? undefined,
    level: (row.level as number) ?? undefined,
    attrs: (row.attrs as Listing["attrs"]) ?? [],
    images: (row.images as string[]) ?? [],
    createdAt: (row.created_at as string)?.slice(0, 10) ?? "",
    views: row.views as number,
    favorites: row.favorites as number,
  };
}

function mapListingWithRelationsRow(row: Record<string, unknown>): ListingWithRelations {
  return {
    ...mapListingRow(row),
    category: mapCategoryRow(row.category as Record<string, unknown>),
    seller: mapSellerRow(row.seller as Record<string, unknown>),
  };
}

function mapReviewRow(row: Record<string, unknown>): Review {
  const author = row.author as { name?: string } | null;
  const listing = row.listing as { title?: LocalizedText } | null;
  return {
    id: row.id as string,
    authorName: author?.name ?? "Пользователь",
    rating: row.rating as number,
    text: row.text as LocalizedText,
    date: (row.created_at as string)?.slice(0, 10) ?? "",
    listingTitle: listing?.title ?? { ru: "", tj: "", en: "" },
  };
}

const LISTING_WITH_RELATIONS_SELECT = "*, category:categories(*), seller:profiles(*)";

export async function getCategories(): Promise<Category[]> {
  const [{ data: cats, error: catError }, { data: rows, error: listError }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("listings").select("category_slug, price"),
  ]);
  if (catError) throw catError;
  if (listError) throw listError;

  const stats = new Map<string, { count: number; minPrice: number }>();
  for (const row of rows ?? []) {
    const s = stats.get(row.category_slug) ?? { count: 0, minPrice: Infinity };
    s.count += 1;
    s.minPrice = Math.min(s.minPrice, Number(row.price));
    stats.set(row.category_slug, s);
  }

  return (cats ?? []).map((c) => mapCategoryRow(c, stats.get(c.slug)));
}

export async function getListingsByCategory(slug: string): Promise<ListingWithRelations[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_RELATIONS_SELECT)
    .eq("category_slug", slug)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapListingWithRelationsRow);
}

export async function getListing(id: string): Promise<ListingWithRelations | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_RELATIONS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapListingWithRelationsRow(data) : null;
}

export async function getFeaturedListings(count = 8): Promise<ListingWithRelations[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_RELATIONS_SELECT)
    .order("views", { ascending: false })
    .limit(count);
  if (error) throw error;
  return (data ?? []).map(mapListingWithRelationsRow);
}

export async function getSeller(id: string): Promise<Seller | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapSellerRow(data) : null;
}

export async function getSellerListings(id: string): Promise<ListingWithRelations[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_RELATIONS_SELECT)
    .eq("seller_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapListingWithRelationsRow);
}

export async function getReviewsForListing(listingId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, text, created_at, author:profiles(name), listing:listings(title)")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapReviewRow);
}

export async function getReviewsForSeller(sellerId: string): Promise<Review[]> {
  const { data: listingRows, error: listError } = await supabase
    .from("listings")
    .select("id")
    .eq("seller_id", sellerId);
  if (listError) throw listError;
  const ids = (listingRows ?? []).map((l) => l.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, text, created_at, author:profiles(name), listing:listings(title)")
    .in("listing_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapReviewRow);
}

export async function createListing(input: {
  categorySlug: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  delivery: DeliveryType;
  images: string[];
}): Promise<Listing> {
  const { data, error } = await supabase
    .from("listings")
    .insert({
      category_slug: input.categorySlug,
      seller_id: input.sellerId,
      title: { ru: input.title, tj: input.title, en: input.title },
      description: { ru: input.description, tj: input.description, en: input.description },
      price: input.price,
      delivery: input.delivery,
      images: input.images,
      attrs: [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapListingRow(data);
}

export async function createOrder(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
  price: number;
  paymentMethod: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      listing_id: input.listingId,
      buyer_id: input.buyerId,
      seller_id: input.sellerId,
      price: input.price,
      payment_method: input.paymentMethod,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
