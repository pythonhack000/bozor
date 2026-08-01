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

export interface Listing {
  id: string;
  categorySlug: string;
  title: LocalizedText;
  description: LocalizedText;
  price: number;
  oldPrice?: number;
  sellerId: string;
  delivery: DeliveryType;
  server?: string;
  level?: number;
  attrs: { label: LocalizedText; value: LocalizedText }[];
  createdAt: string;
  views: number;
  favorites: number;
}
