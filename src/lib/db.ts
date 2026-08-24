import { supabase } from "./supabase";
import type {
  Category,
  DeliveryType,
  DepositRequest,
  DisputedOrder,
  KycSubmission,
  Listing,
  ListingReport,
  LocalizedText,
  Order,
  PaymentMethod,
  Review,
  Seller,
  WithdrawalRequest,
} from "./types";

const PUBLIC_SELLER_COLUMNS =
  "id, name, online, verified, created_at, rating, reviews_count, sales_count, response_time_minutes, city";

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
    kind: (row.kind as Listing["kind"]) ?? "account",
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
    status: (row.status as Listing["status"]) ?? "active",
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

const LISTING_WITH_RELATIONS_SELECT = `*, category:categories(*), seller:profiles(${PUBLIC_SELLER_COLUMNS})`;

export async function getCategories(): Promise<Category[]> {
  const [{ data: cats, error: catError }, { data: rows, error: listError }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("listings").select("category_slug, price").eq("status", "active"),
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
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapListingWithRelationsRow);
}

export async function getAllListings(): Promise<ListingWithRelations[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_RELATIONS_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapListingWithRelationsRow);
}

// Official donate/top-up store: only admin-owned 'topup' listings (enforced
// by the listings insert RLS policy), shown together regardless of category.
export async function getTopupListings(): Promise<ListingWithRelations[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_WITH_RELATIONS_SELECT)
    .eq("status", "active")
    .eq("kind", "topup")
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
    .eq("status", "active")
    .order("views", { ascending: false })
    .limit(count);
  if (error) throw error;
  return (data ?? []).map(mapListingWithRelationsRow);
}

export async function getSeller(id: string): Promise<Seller | null> {
  const { data, error } = await supabase.from("profiles").select(PUBLIC_SELLER_COLUMNS).eq("id", id).maybeSingle();
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

export async function createReview(listingId: string, rating: number, text: string): Promise<void> {
  const { error } = await supabase.rpc("create_review", {
    p_listing_id: listingId,
    p_rating: rating,
    p_text: text,
  });
  if (error) throw error;
}

export async function getMyReviewedListingIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("reviews").select("listing_id").eq("author_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.listing_id as string));
}

export async function hasReviewedListing(userId: string, listingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id")
    .eq("author_id", userId)
    .eq("listing_id", listingId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function hasReleasedOrder(buyerId: string, listingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("buyer_id", buyerId)
    .eq("listing_id", listingId)
    .eq("status", "released")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function createListing(input: {
  categorySlug: string;
  sellerId: string;
  kind: Listing["kind"];
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
      kind: input.kind,
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

// Self-delete: covered by the "sellers can delete own listings" RLS policy
// (auth.uid() = seller_id), so a plain table delete is enough here.
export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) throw error;
}

export async function adminDeleteListing(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_listing", { p_listing_id: id, p_reason: reason });
  if (error) throw error;
}

export async function updateMyProfile(
  userId: string,
  updates: { name?: string; city?: string; online?: boolean }
): Promise<void> {
  if (updates.name !== undefined) {
    const { error } = await supabase.auth.updateUser({ data: { name: updates.name } });
    if (error) throw error;
  }
  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  if (error) throw error;
}

export async function getMyBalance(): Promise<number> {
  const { data, error } = await supabase.rpc("get_my_balance");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function topUpBalance(amount: number): Promise<number> {
  const { data, error } = await supabase.rpc("topup_balance", { p_amount: amount });
  if (error) throw error;
  return Number(data);
}

// ---- Payments: methods, deposits, withdrawals ----------------------------

function mapPaymentMethodRow(row: Record<string, unknown>): PaymentMethod {
  return {
    code: row.code as string,
    name: row.name as LocalizedText,
    details: (row.details as string) ?? "",
    network: (row.network as string) ?? undefined,
    instructions: (row.instructions as LocalizedText) ?? undefined,
    currency: (row.currency as string) ?? "TJS",
    rate: row.rate != null ? Number(row.rate) : undefined,
    minAmount: Number(row.min_amount),
    maxAmount: Number(row.max_amount),
    enabled: Boolean(row.enabled),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("enabled", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map(mapPaymentMethodRow);
}

export async function requestDeposit(
  methodCode: string,
  amount: number,
  proof?: string
): Promise<{ id: string; referenceCode: string }> {
  const { data, error } = await supabase.rpc("request_deposit", {
    p_method_code: methodCode,
    p_amount: amount,
    p_proof: proof ?? null,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return { id: row.id as string, referenceCode: row.reference_code as string };
}

export async function submitDepositProof(id: string, proof: string): Promise<void> {
  const { error } = await supabase.rpc("submit_deposit_proof", { p_id: id, p_proof: proof });
  if (error) throw error;
}

export async function requestWithdrawal(
  methodCode: string,
  amount: number,
  destination: string
): Promise<string> {
  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_method_code: methodCode,
    p_amount: amount,
    p_destination: destination,
  });
  if (error) throw error;
  return data as string;
}

function mapDepositRow(row: Record<string, unknown>): DepositRequest {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    methodCode: row.method_code as string,
    methodName: (row.method_name as LocalizedText) ?? undefined,
    amount: Number(row.amount),
    creditedAmount: row.credited_amount != null ? Number(row.credited_amount) : undefined,
    currency: (row.currency as string) ?? undefined,
    rate: row.rate != null ? Number(row.rate) : undefined,
    referenceCode: (row.reference_code as string) ?? "",
    proof: (row.proof as string) ?? undefined,
    status: (row.status as DepositRequest["status"]) ?? "pending",
    adminNote: (row.admin_note as string) ?? undefined,
    userName: (row.user_name as string) ?? undefined,
    createdAt: (row.created_at as string)?.slice(0, 10) ?? "",
  };
}

function mapWithdrawalRow(row: Record<string, unknown>): WithdrawalRequest {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    methodCode: row.method_code as string,
    methodName: (row.method_name as LocalizedText) ?? undefined,
    amount: Number(row.amount),
    destination: (row.destination as string) ?? "",
    status: (row.status as WithdrawalRequest["status"]) ?? "pending",
    adminNote: (row.admin_note as string) ?? undefined,
    userName: (row.user_name as string) ?? undefined,
    createdAt: (row.created_at as string)?.slice(0, 10) ?? "",
  };
}

export async function getMyDeposits(userId: string): Promise<DepositRequest[]> {
  const { data, error } = await supabase
    .from("deposit_requests")
    .select("*")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDepositRow);
}

export async function getMyWithdrawals(userId: string): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapWithdrawalRow);
}

// ---- Admin: payment moderation + requisites ------------------------------

export async function adminListDeposits(): Promise<DepositRequest[]> {
  const { data, error } = await supabase.rpc("admin_list_deposits");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapDepositRow);
}

export async function adminApproveDeposit(id: string, creditAmount?: number): Promise<void> {
  const { error } = await supabase.rpc("admin_approve_deposit", {
    p_id: id,
    p_credit_amount: creditAmount ?? null,
  });
  if (error) throw error;
}

export async function adminRejectDeposit(id: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_reject_deposit", { p_id: id, p_note: note ?? null });
  if (error) throw error;
}

export async function adminListWithdrawals(): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase.rpc("admin_list_withdrawals");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapWithdrawalRow);
}

export async function adminApproveWithdrawal(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_approve_withdrawal", { p_id: id });
  if (error) throw error;
}

export async function adminRejectWithdrawal(id: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_reject_withdrawal", { p_id: id, p_note: note ?? null });
  if (error) throw error;
}

export async function adminListPaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase.rpc("admin_list_payment_methods");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapPaymentMethodRow);
}

export async function adminUpdatePaymentMethod(input: {
  code: string;
  details: string;
  network?: string;
  minAmount: number;
  maxAmount: number;
  enabled: boolean;
  rate?: number;
}): Promise<void> {
  const { error } = await supabase.rpc("admin_update_payment_method", {
    p_code: input.code,
    p_details: input.details,
    p_network: input.network ?? null,
    p_min_amount: input.minAmount,
    p_max_amount: input.maxAmount,
    p_enabled: input.enabled,
    p_rate: input.rate ?? null,
  });
  if (error) throw error;
}

export async function buyListing(listingId: string, buyerNote?: string): Promise<string> {
  const { data, error } = await supabase.rpc("purchase_listing", {
    p_listing_id: listingId,
    p_buyer_note: buyerNote ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function confirmOrderReceipt(orderId: string): Promise<void> {
  const { error } = await supabase.rpc("confirm_order_receipt", { p_order_id: orderId });
  if (error) throw error;
}

export async function openDispute(orderId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("open_dispute", { p_order_id: orderId, p_reason: reason });
  if (error) throw error;
}

export async function getDisputedOrders(): Promise<DisputedOrder[]> {
  const { data, error } = await supabase.rpc("admin_list_disputed_orders");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    listingTitle: (row.listing_title as LocalizedText) ?? null,
    price: Number(row.price),
    buyerId: row.buyer_id as string,
    buyerName: (row.buyer_name as string) ?? "Пользователь",
    sellerId: row.seller_id as string,
    sellerName: (row.seller_name as string) ?? "Пользователь",
    disputeReason: (row.dispute_reason as string) ?? "",
    disputeOpenedBy: row.dispute_opened_by as string,
    createdAt: (row.created_at as string)?.slice(0, 10) ?? "",
  }));
}

export async function resolveDispute(
  orderId: string,
  resolution: "refund_buyer" | "release_seller"
): Promise<void> {
  const { error } = await supabase.rpc("admin_resolve_dispute", {
    p_order_id: orderId,
    p_resolution: resolution,
  });
  if (error) throw error;
}

export async function reportListing(listingId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("report_listing", { p_listing_id: listingId, p_reason: reason });
  if (error) throw error;
}

export async function getReports(): Promise<ListingReport[]> {
  const { data, error } = await supabase.rpc("admin_list_reports");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    listingId: row.listing_id as string,
    listingTitle: (row.listing_title as LocalizedText) ?? null,
    listingStatus: row.listing_status as ListingReport["listingStatus"],
    reporterName: (row.reporter_name as string) ?? "Пользователь",
    reason: row.reason as string,
    createdAt: (row.created_at as string)?.slice(0, 10) ?? "",
  }));
}

export async function resolveReport(reportId: string, action: "dismiss" | "remove_listing"): Promise<void> {
  const { error } = await supabase.rpc("admin_resolve_report", { p_report_id: reportId, p_action: action });
  if (error) throw error;
}

const ORDER_SELECT = "*, listing:listings(title)";

function mapOrderRow(row: Record<string, unknown>, otherParty: { name?: string } | null): Order {
  const listing = row.listing as { title?: LocalizedText } | null;
  return {
    id: row.id as string,
    listingId: (row.listing_id as string) ?? null,
    listingTitle: listing?.title ?? null,
    buyerId: row.buyer_id as string,
    sellerId: row.seller_id as string,
    otherPartyName: otherParty?.name ?? "Пользователь",
    price: Number(row.price),
    status: row.status as Order["status"],
    credentials: (row.credentials as string) ?? undefined,
    buyerNote: (row.buyer_note as string) ?? undefined,
    disputeReason: (row.dispute_reason as string) ?? undefined,
    createdAt: (row.created_at as string)?.slice(0, 10) ?? "",
  };
}

export async function deliverOrder(orderId: string, credentials: string): Promise<void> {
  const { error } = await supabase.rpc("deliver_order", { p_order_id: orderId, p_credentials: credentials });
  if (error) throw error;
}

export async function getOrdersAsBuyer(buyerId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(`${ORDER_SELECT}, seller:profiles!seller_id(name)`)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapOrderRow(row, row.seller as { name?: string } | null));
}

export async function getOrdersAsSeller(sellerId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(`${ORDER_SELECT}, buyer:profiles!buyer_id(name)`)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapOrderRow(row, row.buyer as { name?: string } | null));
}

// ---- KYC (seller identity verification) -----------------------------------

function mapKycRow(row: Record<string, unknown>): KycSubmission {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    fullName: row.full_name as string,
    passportNumber: row.passport_number as string,
    documentPath: row.document_path as string,
    status: (row.status as KycSubmission["status"]) ?? "pending",
    adminNote: (row.admin_note as string) ?? undefined,
    userName: (row.user_name as string) ?? undefined,
    createdAt: (row.created_at as string)?.slice(0, 10) ?? "",
  };
}

export async function submitKyc(input: {
  fullName: string;
  passportNumber: string;
  documentPath: string;
}): Promise<void> {
  const { error } = await supabase.rpc("submit_kyc", {
    p_full_name: input.fullName,
    p_passport_number: input.passportNumber,
    p_document_path: input.documentPath,
  });
  if (error) throw error;
}

export async function getMyKyc(userId: string): Promise<KycSubmission[]> {
  const { data, error } = await supabase
    .from("kyc_submissions")
    .select("*")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapKycRow);
}

export async function adminListKyc(): Promise<KycSubmission[]> {
  const { data, error } = await supabase.rpc("admin_list_kyc");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapKycRow);
}

export async function adminApproveKyc(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_approve_kyc", { p_id: id });
  if (error) throw error;
}

export async function adminRejectKyc(id: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_reject_kyc", { p_id: id, p_note: note ?? null });
  if (error) throw error;
}

