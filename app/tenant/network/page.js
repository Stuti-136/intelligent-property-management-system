"use client";

import GraphPanel from "@/components/GraphPanel";
import { PageHeader } from "@/components/ui";

export default function TenantNetworkPage() {
  return (
    <>
      <PageHeader
        title="My network"
        sub="Your home, its landlord and the repair requests you have sent."
      />
      <GraphPanel />
    </>
  );
}
