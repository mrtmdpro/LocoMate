"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function TourReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: existing } = trpc.review.getTourReview.useQuery({ tourId: id });

  const submitMutation = trpc.review.submitTourReview.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Thank you for your review!");
    },
    onError: (err) => toast.error(err.message),
  });

  if (existing || submitted) {
    return (
      <div className="p-4 pt-12">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-bold font-heading text-[#3f6f60]">Thanks for reviewing!</h2>
            <p className="text-muted-foreground">Your feedback helps us create better experiences for solo travelers in Hanoi.</p>
            <div className="flex gap-1 justify-center text-3xl">
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} className={s <= (existing?.rating || rating) ? "text-[#ff8c30]" : "text-gray-200"}>★</span>
              ))}
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={() => router.push("/explore")} className="flex-1 bg-[#ff8c30] hover:bg-[#e67a20] text-white rounded-xl">
                Explore More
              </Button>
              <Button onClick={() => router.push("/profile")} variant="outline" className="flex-1 rounded-xl">
                My Profile
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
        <h1 className="text-2xl font-bold font-heading text-[#3f6f60]">How was your tour?</h1>
        <p className="text-sm text-muted-foreground mt-2">Your rating helps us improve and helps other travelers choose</p>
      </div>

      {/* Star Rating */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <p className="text-sm font-semibold text-[#3f6f60] text-center mb-4">Tap to rate</p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-4xl transition-all ${
                  star <= rating ? "text-[#ff8c30] scale-110" : "text-gray-200 hover:text-gray-300"
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            {rating === 0 ? "" : rating <= 2 ? "We'll do better next time" : rating <= 4 ? "Great to hear!" : "Amazing! You loved it!"}
          </p>
        </CardContent>
      </Card>

      {/* Comment */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-[#3f6f60] mb-2">Tell us more (optional)</p>
          <Textarea
            placeholder="What did you enjoy most? Any suggestions?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            className="rounded-xl resize-none h-24"
          />
          <p className="text-[10px] text-muted-foreground text-right mt-1">{comment.length}/500</p>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        onClick={() => submitMutation.mutate({ tourId: id, rating, comment: comment || undefined })}
        disabled={rating === 0 || submitMutation.isPending}
        className="w-full h-14 rounded-2xl bg-[#ff8c30] hover:bg-[#e67a20] text-white font-bold text-base shadow-lg"
      >
        {submitMutation.isPending ? "Submitting..." : "Submit Review"}
      </Button>

      <button onClick={() => router.push("/profile")} className="w-full text-center text-sm text-muted-foreground">
        Skip for now
      </button>
    </div>
  );
}
