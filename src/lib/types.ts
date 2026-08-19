export type Lang = "ru" | "tj" | "en";

export type LocalizedText = Record<Lang, string>;

export interface Category {
  slug: string;
  name: LocalizedText;
  image: string;
  imageFit: "cover" | "contain";
  color: string;
  listingsCount: number;
  fromPrice: number;
}

export interface Seller {
  id: string;
  name: string;
  online: boolean;
  verified: boolean;
  registeredYear: number;
  rating: number;
  reviewsCount: number;
  salesCount: number;
  responseTime: LocalizedText;
  city: string;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  text: LocalizedText;
  date: string;
  listingTitle: LocalizedText;
}

export type DeliveryType = "instant" | "manual";

export type ListingStatus = "pending" | "active" | "sold" | "rejected";

// "account" = a ready-made account for sale. "topup" = a donate/top-up
// service (e.g. PUBG Mobile UC, Standoff 2 Gold) delivered into the buyer's
// own game account — the buyer supplies their in-game ID at purchase time.
export type ListingKind = "account" | "topup";

export interface Listing {
  id: string;
  categorySlug: string;
  kind: ListingKind;
  title: LocalizedText;
  description: LocalizedText;
  price: number;
  oldPrice?: number;
  sellerId: string;
  delivery: DeliveryType;
  status: ListingStatus;
  server?: string;
  level?: number;
  attrs: { label: LocalizedText; value: LocalizedText }[];
  images: string[];
  createdAt: string;
  views: number;
  favorites: number;
}

export type OrderStatus = "paid" | "delivered" | "released" | "disputed" | "refunded";

export interface Order {
  id: string;
  listingId: string | null;
  listingTitle: LocalizedText | null;
  buyerId: string;
  sellerId: string;
  otherPartyName: string;
  price: number;
  status: OrderStatus;
  credentials?: string;
  buyerNote?: string;
  disputeReason?: string;
  createdAt: string;
}

export interface DisputedOrder {
  id: string;
  listingTitle: LocalizedText | null;
  price: number;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  disputeReason: string;
  disputeOpenedBy: string;
  createdAt: string;
}

export type PaymentMethodCode = "alif" | "dc" | "card" | "crypto";

export interface PaymentMethod {
  code: string;
  name: LocalizedText;
  details: string;
  network?: string;
  instructions?: LocalizedText;
  minAmount: number;
  maxAmount: number;
  enabled: boolean;
  sortOrder: number;
}

export type RequestStatus = "pending" | "approved" | "rejected";

export interface DepositRequest {
  id: string;
  methodCode: string;
  methodName?: LocalizedText;
  amount: number;
  referenceCode: string;
  proof?: string;
  status: RequestStatus;
  adminNote?: string;
  userName?: string;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  methodCode: string;
  methodName?: LocalizedText;
  amount: number;
  destination: string;
  status: RequestStatus;
  adminNote?: string;
  userName?: string;
  createdAt: string;
}

export type KycStatus = "pending" | "approved" | "rejected";

export interface KycSubmission {
  id: string;
  fullName: string;
  passportNumber: string;
  documentPath: string;
  status: KycStatus;
  adminNote?: string;
  userName?: string;
  createdAt: string;
}

export interface ListingReport {
  id: string;
  listingId: string;
  listingTitle: LocalizedText | null;
  listingStatus: ListingStatus;
  reporterName: string;
  reason: string;
  createdAt: string;
}
