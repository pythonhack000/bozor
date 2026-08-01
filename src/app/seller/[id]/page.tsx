import { notFound } from "next/navigation";
import { getSeller, sellers } from "@/lib/data";
import { SellerView } from "@/components/SellerView";

export function generateStaticParams() {
  return sellers.map((s) => ({ id: s.id }));
}

export default async function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seller = getSeller(id);
  if (!seller) notFound();

  return <SellerView sellerId={id} />;
}
