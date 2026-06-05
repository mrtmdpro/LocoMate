import { router } from "../trpc";
import { hostProfileProcedures } from "./host/profile";
import { hostAvailabilityProcedures } from "./host/availability";
import { hostBookingsProcedures } from "./host/bookings";
import { hostEarningsProcedures } from "./host/earnings";
import { hostSavedProcedures } from "./host/saved";
import { hostHeatmapProcedures } from "./host/heatmap";

// Decomposed by domain (Cluster F). Procedures live in ./host/* and are
// merged flat here, so every tRPC path (host.getProfile, host.getBalance,
// ...) is unchanged. See docs/CODEBASE_AUDIT_2026-05-29.md.
export const hostRouter = router({
  ...hostProfileProcedures,
  ...hostAvailabilityProcedures,
  ...hostBookingsProcedures,
  ...hostEarningsProcedures,
  ...hostSavedProcedures,
  ...hostHeatmapProcedures,
});
