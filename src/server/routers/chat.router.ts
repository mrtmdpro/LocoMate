import { router } from "../trpc";
import { chatConversationProcedures } from "./chat/conversations";
import { chatMessagingProcedures } from "./chat/messaging";
import { chatReactionProcedures } from "./chat/reactions";
import { chatModerationProcedures } from "./chat/moderation";
import { chatAdminProcedures } from "./chat/admin";

// Decomposed by domain (Cluster F). Procedures live in ./chat/* and are
// merged flat here, so every tRPC path (chat.sendMessage, chat.addReaction,
// ...) is unchanged. Shared helpers/constants live in ./chat/shared.ts.
// See docs/CODEBASE_AUDIT_2026-05-29.md.
export const chatRouter = router({
  ...chatConversationProcedures,
  ...chatMessagingProcedures,
  ...chatReactionProcedures,
  ...chatModerationProcedures,
  ...chatAdminProcedures,
});
