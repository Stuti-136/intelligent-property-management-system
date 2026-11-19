"use client";

import GraphPanel from "@/components/GraphPanel";
import { PageHeader } from "@/components/ui";

export default function LandlordGraphPage() {
  return (
    <>
      <PageHeader
        title="Network"
        sub="How you, your properties, your tenants and their repair requests are connected."
      />
      <GraphPanel />
    </>
  );
}
