import { Suspense } from "react";
import { Loading } from "@/components/ui";
import ClaimView from "./ClaimView";

export default function ClaimPage({ params }: PageProps<"/claims/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <ClaimView params={params} />
    </Suspense>
  );
}
