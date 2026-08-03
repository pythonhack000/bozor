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

export interface Listing {
  id: string;
  categorySlug: string;
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

export type OrderStatus = "paid" | "released" | "disputed" | "refunded";

export interface Order {
  id: string;
  listingId: string | null;
  listingTitle: LocalizedText | null;
  buyerId: string;
  sellerId: string;
  otherPartyName: string;
  price: number;
  status: OrderStatus;
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
