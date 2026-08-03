import { Suspense } from "react";
import { ListingView } from "@/components/ListingView";

export default function ListingPage() {
  return (
    <Suspense fallback={null}>
      <ListingView />
    </Suspense>
  );
}
