import { notFound } from "next/navigation";
import { getListing, listings } from "@/lib/data";
import { ListingView } from "@/components/ListingView";

export function generateStaticParams() {
  return listings.map((l) => ({ id: l.id }));
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = getListing(id);
  if (!listing) notFound();

  return <ListingView listingId={id} />;
}
