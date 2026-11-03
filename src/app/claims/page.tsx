import { Suspense } from "react";
import { Loading } from "@/components/ui";
import ClaimsList from "./ClaimsList";

export default function ClaimsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ClaimsList />
    </Suspense>
  );
}
