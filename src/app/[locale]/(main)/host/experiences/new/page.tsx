"use client";

import { trpc } from "@/lib/trpc";
import { HostExperienceWizard } from "../_wizard";

export default function NewHostExperiencePage() {
  const { data: host } = trpc.host.getProfile.useQuery();
  const hostIsVerified = host?.verificationStatus === "approved";

  return <HostExperienceWizard hostIsVerified={hostIsVerified} />;
}
