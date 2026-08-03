import { Suspense } from "react";
import { SellerView } from "@/components/SellerView";

export default function SellerPage() {
  return (
    <Suspense fallback={null}>
      <SellerView />
    </Suspense>
  );
}
