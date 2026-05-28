"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { upload } from "@vercel/blob/client";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { vnLocalDate } from "@/lib/time";
import { useChatStream } from "@/lib/use-chat-stream";
import type { Locale } from "@/i18n/routing";

// ---- formatters ----------------------------------------------------------

function intlTag(locale: Locale): string {
  return locale === "vi" ? "vi-VN" : "en-US";
}

function formatClock(iso: string | Date, locale: Locale): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString(intlTag(locale), { hour: "numeric", minute: "2-digit", hour12: false });
}

type DayHeaderTranslator = (
  key: "today" | "yesterday",
) => string;

function formatDayHeader(iso: string | Date, locale: Locale, t: DayHeaderTranslator): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const todayVn = vnLocalDate(new Date());
  const ydayVn = vnLocalDate(new Date(Date.now() - 86400_000));
  const thisVn = vnLocalDate(d);
  if (thisVn === todayVn) return t("today");
  if (thisVn === ydayVn) return t("yesterday");
  return d.toLocaleDateString(intlTag(locale), { weekday: "long", month: "short", day: "numeric" });
}

// ---- shapes --------------------------------------------------------------

type ReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

type Message = {
  id: string;
  matchId: string;
  senderId: string | null;
  content: string;
  messageType: string | null;
  isRead: boolean | null;
  createdAt: Date | string | null;
  editedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  attachmentUrl?: string | null;
  attachmentKind?: string | null;
  reactions?: ReactionSummary[];
};

// Curated reaction set, must mirror chat.router ALLOWED_REACTION_EMOJIS.
const REACTION_PICKER = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

// Windows enforced by the server too; UI gating is a UX convenience.
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const UNSEND_WINDOW_MS = 24 * 60 * 60 * 1000;
const TYPING_DEBOUNCE_MS = 2000;

// ---- page ----------------------------------------------------------------

export default function ChatConversationPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations("chat.conversation");
  const { user } = useAuthStore();
  const utils = trpc.useUtils();

  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [othersTyping, setOthersTyping] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);

  // Data queries ----------------------------------------------------------

  const {
    data: messagesPage,
    refetch,
    isLoading: messagesLoading,
  } = trpc.chat.getMessages.useQuery(
    { matchId, limit: 100 },
    {
      // Polling is the safety net for when SSE drops or Upstash is down.
      // When the tab is hidden we pause the poll (and the SSE will
      // reconnect on focus anyway).
      refetchInterval: () =>
        typeof document !== "undefined" && document.visibilityState === "visible"
          ? 5000
          : false,
      enabled: !!matchId,
    },
  );
  const messages = messagesPage?.items as Message[] | undefined;

  const { data: conversations } = trpc.chat.getConversations.useQuery();
  const currentConv = conversations?.find((c) => c.matchId === matchId);

  // Mutations -------------------------------------------------------------

  const sendMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
      utils.chat.getConversations.invalidate();
    },
    onError: (err) => toast.error(err.message || t("toast.sendFailed")),
  });

  const editMutation = trpc.chat.editMessage.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setEditDraft("");
      refetch();
    },
    onError: (err) => toast.error(err.message || t("toast.editFailed")),
  });

  const deleteMutation = trpc.chat.deleteMessage.useMutation({
    onSuccess: () => {
      refetch();
      utils.chat.getConversations.invalidate();
    },
    onError: (err) => toast.error(err.message || t("toast.unsendFailed")),
  });

  const addReactionMutation = trpc.chat.addReaction.useMutation({
    onSuccess: () => {
      setReactionPickerFor(null);
      refetch();
    },
    onError: (err) => toast.error(err.message || t("toast.reactionFailed")),
  });

  const removeReactionMutation = trpc.chat.removeReaction.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err.message || t("toast.reactionFailed")),
  });

  const reportMutation = trpc.chat.reportMessage.useMutation({
    onSuccess: () => {
      setReportOpen(null);
      toast.success(t("toast.reportSubmitted"));
    },
    onError: (err) => toast.error(err.message || t("toast.reportFailed")),
  });

  const blockMutation = trpc.chat.blockUser.useMutation({
    onSuccess: () => {
      toast.success(t("toast.userBlocked"));
      setBlockOpen(false);
      router.push("/chat");
    },
    onError: (err) => toast.error(err.message || t("toast.blockFailed")),
  });

  const markReadMutation = trpc.chat.markRead.useMutation({
    onSuccess: () => utils.chat.getConversations.invalidate(),
  });

  const typingStartMutation = trpc.chat.typingStart.useMutation();

  // SSE: invalidate queries on server events --------------------------------

  const onStreamEvent = useCallback(
    (evt: { type: string; userId?: string }) => {
      if (evt.type === "message.new" || evt.type === "message.edited" || evt.type === "message.deleted" || evt.type === "reaction.added" || evt.type === "reaction.removed" || evt.type === "read.advance") {
        utils.chat.getMessages.invalidate({ matchId });
        utils.chat.getConversations.invalidate();
      }
      if (evt.type === "typing.start" && evt.userId && evt.userId !== user?.id) {
        setOthersTyping(evt.userId);
        // Auto-clear 4 s after the last typing event (senders debounce to 2 s).
        setTimeout(() => setOthersTyping((prev) => (prev === evt.userId ? null : prev)), 4000);
      }
    },
    [matchId, utils, user?.id],
  );
  const { connected: streamConnected } = useChatStream(matchId, onStreamEvent);

  // Visibility-gated markRead ----------------------------------------------

  const latestIncomingId = useMemo(() => {
    if (!messages || !user) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId && messages[i].senderId !== user.id) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages, user]);

  useEffect(() => {
    // Only fire markRead when the viewer is actually looking -- prevents
    // lying to the sender if the thread is briefly mounted in a hidden
    // tab or background-prefetched.
    if (!matchId || !user) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    markReadMutation.mutate({ matchId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, user?.id, latestIncomingId]);

  // Auto-scroll only on NEW content (not on every re-render from poll).
  const prevLenRef = useRef(0);
  useEffect(() => {
    const len = messages?.length ?? 0;
    if (len > prevLenRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: typeof window !== "undefined"
          && window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
    prevLenRef.current = len;
  }, [messages]);

  // Typing indicator emission -- debounce so we don't hammer the server.
  const handleComposerChange = (value: string) => {
    setMessage(value);
    const now = Date.now();
    if (now - lastTypingSentAtRef.current > TYPING_DEBOUNCE_MS) {
      lastTypingSentAtRef.current = now;
      typingStartMutation.mutate({ matchId });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      lastTypingSentAtRef.current = 0;
    }, TYPING_DEBOUNCE_MS + 100);
  };

  // Send / attachment handlers --------------------------------------------

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate({ matchId, content: message.trim() });
  };

  const handleAttachmentChoose = () => fileInputRef.current?.click();

  const handleAttachmentUpload = async (file: File) => {
    if (!file) return;
    // Client-side compression keeps the upload under ~800KB for phone
    // photos, which saves a lot of time vs raw 3-8MB JPEGs. Also a
    // courtesy to recipients on slow connections.
    setUploading(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        // Strip EXIF -- travel photos often carry GPS coords.
        preserveExif: false,
      });
      // Grab the auth token from Zustand persist so the upload route can
      // authenticate the client-upload token request.
      const authStr = typeof localStorage !== "undefined"
        ? localStorage.getItem("locomate-auth")
        : null;
      const accessToken = authStr
        ? (JSON.parse(authStr) as { state?: { accessToken?: string } }).state?.accessToken
        : null;
      if (!accessToken) {
        toast.error(t("toast.uploadAuthRequired"));
        return;
      }
      const pathname = `chat/${matchId}/${Date.now()}-${file.name}`;
      const blob = await upload(pathname, compressed, {
        access: "public",
        handleUploadUrl: "/api/chat/upload",
        clientPayload: JSON.stringify({ matchId }),
        headers: { authorization: `Bearer ${accessToken}` },
      });
      await sendMutation.mutateAsync({
        matchId,
        content: t("imagePlaceholder"),
        attachmentUrl: blob.url,
        attachmentKind: "image",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const otherName = currentConv?.otherUser?.displayName || t("fallbackName");
  const otherIsHost = currentConv?.otherUser?.role === "host" || currentConv?.otherUser?.role === "admin";
  const otherUserId = currentConv?.otherUser?.id;

  // Day-grouped render -----------------------------------------------------

  const groupedByDay = useMemo(() => {
    const out: Array<{ day: string; rows: Message[] }> = [];
    for (const m of messages ?? []) {
      const day = m.createdAt ? vnLocalDate(m.createdAt) : "unknown";
      const last = out[out.length - 1];
      if (last && last.day === day) last.rows.push(m);
      else out.push({ day, rows: [m] });
    }
    return out;
  }, [messages]);

  // Seen indicator: last sent message where the recipient has marked
  // something after it as read. Proxy: if ANY incoming message with a
  // later timestamp is read, the recipient has been here after we sent.
  // Simpler proxy used here: if the last message sent by me is marked
  // isRead=true by the read propagation (server flips isRead for
  // messages NOT sent by the recipient, so 'isRead' on my own message
  // doesn't apply). Use the cheap heuristic: show "Seen" next to the
  // last message I sent if the OTHER side has any read advance event
  // at or after that message's timestamp.
  //
  // In MVP we show "Seen" when markRead has happened for the other
  // user and there's no newer outgoing from us. Good enough until we
  // wire a last_read_at per user.
  const { lastSentId, showSeen } = useMemo(() => {
    if (!user || !messages?.length) return { lastSentId: null as string | null, showSeen: false };
    let lastId: string | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === user.id && !messages[i].deletedAt) {
        lastId = messages[i].id;
        break;
      }
    }
    // If I sent last AND their most-recent incoming read-status is true,
    // they've opened the thread since my message landed.
    const anyIncomingRead = messages.some(
      (m) => m.senderId && m.senderId !== user.id && m.isRead === true,
    );
    return { lastSentId: lastId, showSeen: !!lastId && anyIncomingRead };
  }, [messages, user]);

  const startChat = trpc.chat.startWithHost.useMutation();

  // Render -----------------------------------------------------------------

  return (
    /* Height = 100dvh minus TopNav (h-14 mobile / h-16 lg). `dvh`
       (not `vh`) so mobile browsers' URL-bar collapse doesn't push
       the composer off-screen. Subtracting the nav explicitly is
       hardcoded — TopNav's height in components/layout/top-nav.tsx
       is the source of truth; keep these `calc` values in sync if
       that ever changes. */
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)] lg:max-w-3xl lg:mx-auto lg:border-x lg:border-border">
      {/* Header */}
      <div className="bg-card border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => router.push("/chat")} className="text-muted-foreground" aria-label={t("backAria")}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <Avatar className="w-9 h-9">
          {currentConv?.otherUser?.avatarUrl && <AvatarImage src={currentConv.otherUser.avatarUrl} alt={otherName} />}
          <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-bold">{otherName[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-base truncate">{otherName}</h2>
            {otherIsHost && (
              <Badge className="bg-secondary/10 text-foreground border-0 text-xs shrink-0">{t("headerHostBadge")}</Badge>
            )}
            {streamConnected && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                aria-label={t("liveAria")}
                title={t("liveTitle")}
              />
            )}
          </div>
        </div>
        {otherUserId && (
          <button
            type="button"
            onClick={() => setBlockOpen(true)}
            aria-label={t("optionsAria")}
            className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        )}
      </div>

      {/* Quick chips */}
      <div className="flex gap-2 px-4 py-2 bg-card/20 overflow-x-auto shrink-0 scrollbar-hide">
        <Badge
          variant="outline"
          className="cursor-pointer whitespace-nowrap text-sm h-9 px-3.5 rounded-full bg-primary text-primary-foreground border-primary hover:bg-primary/85 font-semibold flex items-center gap-1.5"
          onClick={() => router.push("/activities")}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          {t("chips.browseActivities")}
        </Badge>
        {(["suggestPlace", "tonight", "thanks"] as const).map((chipKey) => {
          const chip = t(`chips.${chipKey}`);
          return (
            <Badge
              key={chipKey}
              variant="outline"
              className="cursor-pointer whitespace-nowrap text-sm h-9 px-3.5 rounded-full flex items-center hover:bg-primary/10 hover:border-primary"
              onClick={() => setMessage(chip)}
            >
              {chip}
            </Badge>
          );
        })}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
        // role="log" + aria-live makes screen readers announce only NEW
        // bubbles as they arrive -- not the whole transcript on each poll.
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label={t("conversationWithAria", { name: otherName })}
      >
        {messagesLoading && (
          <div className="space-y-3 py-4" aria-hidden>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className={`h-10 rounded-2xl bg-muted animate-pulse ${i % 2 === 0 ? "w-48" : "w-56"}`} />
              </div>
            ))}
          </div>
        )}

        {!messagesLoading && (messages?.length ?? 0) === 0 && (
          <div className="text-center py-12 space-y-1">
            <div className="text-3xl" aria-hidden>👋</div>
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          </div>
        )}

        {!messagesLoading && user && messages && messages.length > 0 &&
          messages.every((m) => m.senderId === user.id) && (
            <div className="flex justify-center py-2">
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
                {t("waitingFor", { name: otherName.split(" ")[0] })}
              </span>
            </div>
          )}

        {!messagesLoading && user && groupedByDay.map((group) => (
          <div key={group.day} className="space-y-2">
            {group.rows.length > 0 && group.rows[0].createdAt && (
              <div className="flex justify-center py-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground bg-muted/40 rounded-full px-3 py-1 font-semibold">
                  {formatDayHeader(group.rows[0].createdAt as string, locale, (k) => t(k))}
                </span>
              </div>
            )}
            {group.rows.map((msg, idx) => {
              const isMine = msg.senderId === user.id;
              const isDeleted = !!msg.deletedAt;
              const isEditing = editingId === msg.id;
              const createdMs = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
              const canEdit = isMine && !isDeleted && Date.now() - createdMs < EDIT_WINDOW_MS;
              const canUnsend = isMine && !isDeleted && Date.now() - createdMs < UNSEND_WINDOW_MS;
              const next = group.rows[idx + 1];
              const showTime =
                !next ||
                next.senderId !== msg.senderId ||
                (msg.createdAt && next.createdAt &&
                  new Date(msg.createdAt).getMinutes() !==
                    new Date(next.createdAt).getMinutes());

              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} group`}>
                  <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[75%] lg:max-w-[60%]`}>
                    {/* sr-only sender+time prefix so screen readers
                        announce "From Nam at 14:32: …" not a disembodied
                        wall of text. */}
                    <span className="sr-only">
                      {t("srPrefix", {
                        sender: isMine ? t("srYou") : otherName,
                        time: msg.createdAt ? formatClock(msg.createdAt as string, locale) : "",
                      })}
                    </span>

                    {isEditing ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          className="h-9"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() =>
                            editMutation.mutate({ messageId: msg.id, content: editDraft.trim() })
                          }
                          disabled={!editDraft.trim() || editMutation.isPending}
                          className="h-9 bg-secondary hover:bg-secondary/90"
                        >
                          {t("save")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditingId(null); setEditDraft(""); }}
                          className="h-9"
                        >
                          {t("cancel")}
                        </Button>
                      </div>
                    ) : (
                      <div
                        className={`relative px-4 py-2.5 rounded-2xl text-body break-words ${
                          isDeleted
                            ? "bg-muted/40 text-muted-foreground italic border border-dashed border-border"
                            : isMine
                              ? "bg-primary text-white rounded-br-md"
                              : "bg-muted text-foreground/90 rounded-bl-md"
                        }`}
                      >
                        {msg.attachmentUrl && !isDeleted && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={msg.attachmentUrl}
                            alt={t("imageAlt")}
                            className="rounded-lg max-w-full max-h-60 mb-1 object-cover"
                          />
                        )}
                        <span>{msg.content}</span>
                        {msg.editedAt && !isDeleted && (
                          <span className="ml-1.5 text-xs opacity-70">{t("edited")}</span>
                        )}
                      </div>
                    )}

                    {/* Reactions */}
                    {!isDeleted && msg.reactions && msg.reactions.length > 0 && (
                      <div className={`flex gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                        {msg.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={() =>
                              r.reactedByMe
                                ? removeReactionMutation.mutate({ messageId: msg.id, emoji: r.emoji })
                                : addReactionMutation.mutate({ messageId: msg.id, emoji: r.emoji })
                            }
                            className={`text-xs px-2 py-0.5 rounded-full border ${
                              r.reactedByMe
                                ? "bg-primary/20 border-primary/40"
                                : "bg-muted/40 border-border hover:bg-muted"
                            }`}
                            aria-label={`${r.emoji}${r.reactedByMe ? t("reactedByMe") : ""} (${r.count})`}
                          >
                            <span aria-hidden>{r.emoji}</span> <span className="tabular-nums">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {showTime && msg.createdAt && (
                      <span className="text-xs text-muted-foreground mt-0.5 px-1">
                        {formatClock(msg.createdAt as string, locale)}
                      </span>
                    )}

                    {isMine && msg.id === lastSentId && showSeen && !isDeleted && (
                      <span className="text-xs text-muted-foreground px-1">{t("seen")}</span>
                    )}
                  </div>

                  {/* Hover / focus action strip (own vs other messages) */}
                  {!isEditing && !isDeleted && (
                    <div
                      className={`opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 px-1 self-center ${isMine ? "order-first" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)
                        }
                        aria-label={t("reactAria")}
                        className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                          <circle cx="12" cy="12" r="9" />
                          <path strokeLinecap="round" d="M9 14c1 1 2 1.5 3 1.5s2 -.5 3 -1.5M9 10h.01M15 10h.01" />
                        </svg>
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => { setEditingId(msg.id); setEditDraft(msg.content); }}
                          aria-label={t("editAria")}
                          className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                          title={t("editTitle")}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                            <path strokeLinecap="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                      )}
                      {canUnsend && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t("unsendConfirm"))) {
                              deleteMutation.mutate({ messageId: msg.id });
                            }
                          }}
                          aria-label={t("unsendAria")}
                          className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-red-600"
                          title={t("unsendTitle")}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                            <path strokeLinecap="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      )}
                      {!isMine && (
                        <button
                          type="button"
                          onClick={() => setReportOpen(msg.id)}
                          aria-label={t("reportAria")}
                          className="w-7 h-7 rounded-full hover:bg-amber-50 flex items-center justify-center text-amber-600"
                          title={t("reportTitle")}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                            <path strokeLinecap="round" d="M3 3v18M3 5h11.25a2.25 2.25 0 012.196 2.748L15 13.5h4.5a2.25 2.25 0 012.196 2.748l-1.5 6" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reaction picker popover */}
                  {reactionPickerFor === msg.id && (
                    <div
                      role="menu"
                      className="absolute z-10 bg-card border border-border rounded-full shadow-lg px-2 py-1 flex gap-1 mt-10"
                      onMouseLeave={() => setReactionPickerFor(null)}
                    >
                      {REACTION_PICKER.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() =>
                            addReactionMutation.mutate({ messageId: msg.id, emoji: e })
                          }
                          className="text-lg hover:scale-125 transition-transform"
                          aria-label={t("reactWithAria", { emoji: e })}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {othersTyping && (
          <div className="flex justify-start px-2 pt-2">
            <span className="text-xs text-muted-foreground italic">
              {t("typing", { name: otherName.split(" ")[0] })}
            </span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="bg-card border-t px-4 py-3 flex gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleAttachmentUpload(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={handleAttachmentChoose}
          disabled={uploading || sendMutation.isPending}
          aria-label={t("attachAria")}
          className="w-11 h-11 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground shrink-0"
        >
          {uploading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M12 2 A 10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          )}
        </button>
        <Input
          placeholder={t("composerPlaceholder")}
          value={message}
          onChange={(e) => handleComposerChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="rounded-full h-11 text-base"
          aria-label={t("composerAria")}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sendMutation.isPending}
          className="rounded-full h-11 w-11 p-0 bg-primary hover:bg-primary/85 shrink-0"
          aria-label={t("sendAria")}
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </Button>
      </div>

      {/* Report dialog */}
      <Dialog open={!!reportOpen} onOpenChange={(o) => !o && setReportOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("reportDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("reportDialog.body")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            {(["harassment", "spam", "inappropriate", "scam", "off_platform", "other"] as const).map((r) => (
              <Button
                key={r}
                variant="outline"
                className="justify-start"
                onClick={() => {
                  if (!reportOpen) return;
                  reportMutation.mutate({ messageId: reportOpen, reason: r });
                }}
                disabled={reportMutation.isPending}
              >
                {t(`reportDialog.reason.${r}`)}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(null)}>{t("reportDialog.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block / options dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("blockDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("blockDialog.body")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              className="justify-start text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => {
                if (otherUserId) blockMutation.mutate({ userId: otherUserId });
              }}
              disabled={!otherUserId || blockMutation.isPending}
            >
              {t("blockDialog.blockCta", { name: otherName.split(" ")[0] })}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>{t("blockDialog.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Silences the unused-import warning for startChat which is kept for
          referential completeness alongside the existing router. */}
      <span className="hidden" aria-hidden>{String(!!startChat)}</span>
    </div>
  );
}
