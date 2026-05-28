"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogoLockup } from "@/components/brand";
import { AiChat, streamQuizQuestion, type AiChatMessage } from "@/components/brand";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import {
  QUIZ_QUESTIONS,
  scorePersonality,
  toVectorV4,
  type QuizAnswer,
} from "@/lib/quiz-questions";
import type { AiTone } from "@/server/services/llm-types";

/**
 * Phase A.8 — chatbot personality quiz.
 *
 * Flow:
 *   1. Tone picker — three brand voices. Sets `aiTone` locally; saved to
 *      `userProfiles.explicitData.aiTone` at completion.
 *   2. Five questions streamed in italic-serif from the LLM service
 *      (mocked in Phase A, DeepSeek in Phase C). Each question shows
 *      answer chips below it.
 *   3. Done state — shows the computed personality label and a button to
 *      jump to /home (or to /profile/preferences for fine-tuning).
 *
 * Demo path: `?mock=true` forces canned answers regardless of the
 * `LLM_MOCK_MODE` env (already mock by default in dev — this is the
 * pitch-deck escape hatch for when Phase C ships real generation).
 */

/**
 * The three brand-voice tones. `label` stays in Vietnamese in both
 * locales — these are proper-noun-style voice names the brand has
 * committed to (same rule as the home-page chapter titles per
 * messages/README.md). The descriptive `sub` line is locale-aware and
 * resolves via `t("toneSub.<subKey>")`.
 */
const TONE_OPTIONS: {
  value: AiTone;
  label: string;
  subKey: "thuThi" | "homHinh" | "trucDien";
}[] = [
  { value: "thu-thi", label: "Thủ thỉ tâm tình", subKey: "thuThi" },
  { value: "hom-hinh", label: "Hóm hỉnh lém lỉnh", subKey: "homHinh" },
  { value: "truc-dien", label: "Trực diện nhanh gọn", subKey: "trucDien" },
];

/**
 * Wrap the page in Suspense so `useSearchParams()` (used by the
 * `?mock=true` demo override) doesn't bail out static generation.
 * Next 16 requires this boundary for any client component that reads
 * search params — without it, `next build` fails the page export. The
 * fallback is a quiet empty background so the swap isn't perceptible.
 */
export default function OnboardingChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <OnboardingChatPageInner />
    </Suspense>
  );
}

function OnboardingChatPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, accessToken, setAuth, refreshToken } = useAuthStore();
  const utils = trpc.useUtils();
  const t = useTranslations("onboarding.chat");
  const savePersonality = trpc.user.savePersonality.useMutation();
  const submitOnboarding = trpc.user.submitOnboarding.useMutation({
    onSuccess: () => {
      if (user && accessToken && refreshToken) {
        setAuth({ ...user, onboardingCompleted: true }, accessToken, refreshToken);
      }
    },
  });

  const nickname = user?.displayName?.split(/\s+/)[0];

  const [tone, setTone] = useState<AiTone | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [picks, setPicks] = useState<QuizAnswer[]>([]);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  // Ask the next question. Streams the prompt via the LLM service, adds
  // chunks to the AI bubble as they arrive. Falls back to the
  // deterministic prompt template if the stream errors out.
  const askNext = useCallback(
    async (idx: number) => {
      const q = QUIZ_QUESTIONS[idx];
      if (!q) {
        setDone(true);
        return;
      }
      const aiId = `ai-${q.id}`;
      // Seed the bubble with empty text; chunks will fill it in.
      setMessages((prev) => [
        ...prev,
        {
          kind: "ai",
          id: aiId,
          text: "",
          answers: q.answers.map((a) => ({ id: a.id, label: a.label, sub: a.sub })),
        },
      ]);
      setStreamingId(aiId);
      try {
        const promptText = q.prompt.replaceAll(
          "{nickname}",
          nickname?.trim() || "bạn lữ khách",
        );
        await streamQuizQuestion({
          questionId: q.id,
          questionPrompt: promptText,
          nickname: nickname,
          tone: tone ?? undefined,
          authToken: accessToken ?? undefined,
          onChunk: (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiId && m.kind === "ai"
                  ? { ...m, text: m.text + chunk }
                  : m,
              ),
            );
          },
        });
      } catch (err) {
        console.error("quiz stream failed", err);
        // Fallback: show the deterministic prompt template directly so
        // the chat doesn't dead-end if the SSE route ever breaks.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId && m.kind === "ai"
              ? {
                  ...m,
                  text: q.prompt.replaceAll(
                    "{nickname}",
                    nickname?.trim() || "bạn lữ khách",
                  ),
                }
              : m,
          ),
        );
      } finally {
        setStreamingId(null);
      }
    },
    [accessToken, nickname, tone],
  );

  // Auto-start the quiz once the user picks a tone.
  useEffect(() => {
    if (!tone) return;
    if (startedRef.current) return;
    startedRef.current = true;
    void askNext(0);
  }, [tone, askNext]);

  const handleAnswer = useCallback(
    async (messageId: string, answerId: string) => {
      // Lock the picker on this message.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.kind === "ai" && m.answers
            ? { ...m, pickedId: answerId }
            : m,
        ),
      );
      // Find the underlying question + answer to add to picks.
      const qIdx = QUIZ_QUESTIONS.findIndex((q) => `ai-${q.id}` === messageId);
      if (qIdx === -1) return;
      const q = QUIZ_QUESTIONS[qIdx];
      const answer = q.answers.find((a) => a.id === answerId);
      if (!answer) return;

      // Echo the user's pick as a sans bubble.
      setMessages((prev) => [
        ...prev,
        { kind: "user", id: `user-${q.id}`, text: answer.label },
      ]);
      setPicks((prev) => [...prev, answer]);

      const nextIdx = qIdx + 1;
      setQuestionIdx(nextIdx);
      // Pause briefly so the user reads their own message before the AI
      // pipes the next question.
      await new Promise((r) => setTimeout(r, 350));
      if (nextIdx < QUIZ_QUESTIONS.length) {
        void askNext(nextIdx);
      } else {
        setDone(true);
      }
    },
    [askNext],
  );

  // Save tone + personalityLabel + 4-D personalityVector when the quiz
  // finishes. Idempotent: re-renders shouldn't double-write. The vector
  // feeds the Fixed Tour cosine matcher (server/lib/cosine.ts).
  const savedRef = useRef(false);
  useEffect(() => {
    if (!done || savedRef.current || !tone) return;
    savedRef.current = true;
    const { label, vector } = scorePersonality(picks);
    const personalityVector = toVectorV4(vector);
    savePersonality.mutate(
      { tone, personalityLabel: label, personalityVector },
      {
        onSuccess: () => {
          utils.user.getProfile.invalidate();
        },
        onError: (e) => {
          // Non-blocking — the user can re-take the quiz later from
          // /profile/preferences.
          toast.error(e.message ?? t("saveError"));
        },
      },
    );
  }, [done, picks, savePersonality, tone, utils]);

  const personality = useMemo(() => scorePersonality(picks), [picks]);
  const isMockOverride = search?.get("mock") === "true";

  // Mark traveler onboarding as complete after the chat finishes (the
  // legacy /onboarding page does this via submitOnboarding). We call the
  // same mutation with minimal data; the rest of the explicitData
  // (intent, interests, etc.) gets filled in by the matching engine on
  // first /home load.
  //
  // Navigation uses `onSettled` (not `onSuccess`) so the user always
  // leaves the Done card — even when the server rejects the call (stale
  // session, transient 5xx, network drop). The personality vector was
  // already persisted by the `savePersonality.mutate` in the
  // `done`-effect above, so a submitOnboarding failure here doesn't
  // discard the user's actual quiz answers. `onError` surfaces a toast
  // so the user knows the completion flag didn't stick and can re-take
  // the quiz from /profile/preferences if they want.
  const handleContinue = () => {
    submitOnboarding.mutate(
      {
        intent: [],
        scenario_choice: "A",
        style: { chill_explore: 0.5, plan_spontaneous: 0.5 },
        interests: [],
        budget: "medium",
        social_preference: "meet_new",
        time_preference: ["morning"],
      },
      {
        onError: (e) => {
          toast.error(e.message ?? t("saveError"));
        },
        onSettled: () => {
          router.push("/home");
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-2xl mx-auto pt-4 lg:pt-8 space-y-6">
        <div className="flex justify-center">
          <LogoLockup size="md" />
        </div>

        {!tone && (
          <Card>
            <CardContent className="p-6 lg:p-8 space-y-5">
              <div className="flex flex-col gap-2">
                <span className="text-eyebrow">{t("tonePicker.eyebrow")}</span>
                <h1 className="text-h1 font-voice text-foreground font-normal leading-tight">
                  {t("tonePicker.title")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("tonePicker.subtitle")}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTone(opt.value)}
                    className="flex flex-col items-start gap-1 rounded-md border border-foreground/15 bg-card p-4 text-left hover:bg-muted hover:border-primary/30 transition-colors"
                  >
                    <span className="font-serif italic text-lg text-foreground font-normal leading-tight">
                      {opt.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`toneSub.${opt.subKey}`)}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("tonePicker.footerPrompt")}{" "}
                <Link href="/onboarding" className="underline text-brick decoration-brick/40 underline-offset-4">
                  {t("tonePicker.footerLink")}
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        )}

        {tone && !done && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-eyebrow">
                  {t("progress.eyebrow", {
                    current: Math.min(questionIdx + 1, QUIZ_QUESTIONS.length),
                    total: QUIZ_QUESTIONS.length,
                  })}
                </span>
                <h2 className="text-h2 font-voice text-foreground font-normal leading-tight">
                  {t("progress.title")}
                </h2>
              </div>
              {isMockOverride && (
                <span className="text-xs text-muted-foreground font-mono">
                  mock=true
                </span>
              )}
            </div>
            <AiChat
              messages={messages}
              streamingMessageId={streamingId}
              onAnswer={handleAnswer}
              tone={tone}
            />
          </>
        )}

        {done && (
          <Card>
            <CardContent className="p-6 lg:p-8 space-y-5 relative overflow-hidden">
              <div className="flex flex-col gap-2">
                <span className="text-eyebrow">{t("done.eyebrow")}</span>
                <h1 className="font-serif italic text-4xl text-brick font-normal leading-tight">
                  {personality.label}.
                </h1>
                <p className="text-sm text-muted-foreground max-w-md">
                  {t(`personality.${personalityAxisKey(personality.axis)}`)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="brand"
                  onClick={handleContinue}
                  disabled={submitOnboarding.isPending}
                >
                  {submitOnboarding.isPending ? t("done.ctaSubmitting") : t("done.ctaSubmit")}
                </Button>
                <Link href="/profile/preferences">
                  <Button variant="link" size="brand">
                    {t("done.ctaPreferences")}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * Map the `axis` field returned by `scorePersonality` to a stable i18n
 * key in the `onboarding.chat.personality.*` namespace. The five named
 * axes pass through verbatim; "balanced" is the default-tie label.
 * Returning a known key on every input prevents the runtime
 * `next-intl` "missing key" warning that would otherwise fire when
 * a future scorePersonality variant introduces a new axis name.
 */
function personalityAxisKey(
  axis: string,
): "heritage" | "food" | "craft" | "quiet" | "social" | "balanced" {
  switch (axis) {
    case "heritage":
    case "food":
    case "craft":
    case "quiet":
    case "social":
      return axis;
    default:
      return "balanced";
  }
}
