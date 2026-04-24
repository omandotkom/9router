import { Suspense } from "react";
import { CardSkeleton } from "@/shared/components/Loading";
import QuotaDashboardClient from "./QuotaDashboardClient";

export default function QuotaPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <QuotaDashboardClient />
    </Suspense>
  );
}
