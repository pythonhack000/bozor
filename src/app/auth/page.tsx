import { Suspense } from "react";
import { AuthView } from "@/components/AuthView";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthView />
    </Suspense>
  );
}
