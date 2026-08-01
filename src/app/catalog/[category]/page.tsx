import { notFound } from "next/navigation";
import { categories, getCategory } from "@/lib/data";
import { CatalogView } from "@/components/CatalogView";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();

  return <CatalogView categorySlug={category} />;
}
