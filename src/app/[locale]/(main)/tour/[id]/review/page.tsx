"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function TourReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("tour.review");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: existing, isLoading: reviewLoading } = trpc.review.getTourReview.useQuery({ tourId: id });

  const submitMutation = trpc.review.submitTourReview.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success(t("toastThankYou"));
    },
    onError: (err) => toast.error(err.message),
  });

  if (reviewLoading) {
    return (
      <div className="p-4 pt-8 space-y-6">
        <div className="text-center"><div className="h-12 w-12 bg-muted/80 rounded-full mx-auto animate-pulse" /><div className="h-7 w-48 bg-muted/80 rounded mx-auto mt-4 animate-pulse" /></div>
        <div className="h-28 bg-muted rounded-xl animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (existing || submitted) {
    return (
      <div className="p-4 pt-12">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-bold font-heading text-secondary">{t("done.title")}</h2>
            <p className="text-muted-foreground">{t("done.body")}</p>
            <div className="flex gap-1 justify-center text-3xl">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className={s <= (existing?.rating || rating) ? "text-primary" : "text-muted-foreground/30"}>★</span>
              ))}
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={() => router.push("/explore")} className="flex-1 bg-primary hover:bg-primary/85 text-primary-foreground rounded-xl">
                {t("done.exploreMoreCta")}
              </Button>
              <Button onClick={() => router.push("/profile")} variant="outline" className="flex-1 rounded-xl">
                {t("done.profileCta")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 pt-8 space-y-6">
      <div className="text-center">
        <div className="text-5xl mb-4">✨</div>
        <h1 className="text-2xl font-bold font-heading text-secondary">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      {/* Star Rating */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <p className="text-sm font-semibold text-secondary text-center mb-4">{t("tapToRate")}</p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-4xl transition-all ${
                  star <= rating ? "text-primary scale-110" : "text-muted-foreground/30 hover:text-muted-foreground/60"
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            {rating === 0 ? "" : rating <= 2 ? t("ratingFeedback.low") : rating <= 4 ? t("ratingFeedback.mid") : t("ratingFeedback.high")}
          </p>
        </CardContent>
      </Card>

      {/* Comment */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-secondary mb-2">{t("commentTitle")}</p>
          <Textarea
            placeholder={t("commentPlaceholder")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            className="rounded-xl resize-none h-24"
          />
          <p className="text-xs text-muted-foreground text-right mt-1">{comment.length}/500</p>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        onClick={() => submitMutation.mutate({ tourId: id, rating, comment: comment || undefined })}
        disabled={rating === 0 || submitMutation.isPending}
        className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/85 text-primary-foreground font-bold text-base shadow-lg"
      >
        {submitMutation.isPending ? t("submittingCta") : t("submitCta")}
      </Button>

      <button onClick={() => router.push("/profile")} className="w-full text-center text-sm text-muted-foreground">
        {t("skipCta")}
      </button>
    </div>
  );
}
