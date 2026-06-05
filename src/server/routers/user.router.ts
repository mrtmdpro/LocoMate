import { router } from "../trpc";
import { userProfileProcedures } from "./user/profile";
import { userRoleProcedures } from "./user/roles";
import { userLetterProcedures } from "./user/letters";
import { userEmergencyProcedures } from "./user/emergency";
import { userAccountProcedures } from "./user/account";

// Decomposed by domain (Cluster F). Procedures live in ./user/* and are
// merged flat here, so every tRPC path (user.getProfile, user.deleteAccount,
// ...) is unchanged. See docs/CODEBASE_AUDIT_2026-05-29.md.
export const userRouter = router({
  ...userProfileProcedures,
  ...userRoleProcedures,
  ...userLetterProcedures,
  ...userEmergencyProcedures,
  ...userAccountProcedures,
});
