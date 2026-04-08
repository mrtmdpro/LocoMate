"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "qr">("card");
  const [promoCode, setPromoCode] = useState("");

  const { data: tour } = trpc.tour.getPreview.useQuery({ tourId: id });
  const createIntentMutation = trpc.payment.createIntent.useMutation();
  const confirmMutation = trpc.payment.confirm.useMutation({
    onSuccess: (result) => {
      router.push(`/tour/${result.tourId}`);
    },
  });

  const amount = tour?.priceAmount || 250000;
  const packageLabel = tour?.packageType === "solo_mate" ? "Solo Mate" : tour?.packageType === "social_tour" ? "Social Tour" : "Loco Route";
  const tourData = (tour?.tourData || {}) as { title?: string };

  async function handlePay() {
    const intent = await createIntentMutation.mutateAsync({ tourId: id, paymentMethod });
    await confirmMutation.mutateAsync({ paymentId: intent.paymentId });
  }

  return (
    <div className="p-4 space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <h1 className="text-xl font-bold font-heading text-[#3f6f60]">Checkout</h1>
      </div>

      {/* Order Summary */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-[#3f6f60] mb-3">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{packageLabel}</span>
              <Badge className="bg-[#ff8c30]/10 text-[#ff8c30] border-[#ff8c30]/20">{packageLabel}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tour</span>
              <span>{tourData.title || "Hanoi Discovery"}</span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-[#3f6f60]">{amount.toLocaleString()} VND</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Promo Code */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-[#3f6f60] mb-2">Promo Code</h3>
          <div className="flex gap-2">
            <Input placeholder="Enter code" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="rounded-xl" />
            <Button variant="outline" className="rounded-xl shrink-0">Apply</Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-[#3f6f60]">Payment Method</h3>
          {(["card", "qr"] as const).map((method) => (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                paymentMethod === method ? "border-[#ff8c30] bg-[#ff8c30]/5" : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method === "card" ? "bg-blue-50" : "bg-purple-50"}`}>
                {method === "card" ? (
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" /></svg>
                )}
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">{method === "card" ? "Credit/Debit Card" : "QR Payment"}</p>
                <p className="text-xs text-muted-foreground">{method === "card" ? "Visa, Mastercard" : "MoMo, VNPay QR"}</p>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Refund Policy */}
      <div className="bg-[#D9EDBF]/30 rounded-xl p-3 text-center">
        <p className="text-xs text-[#3f6f60]">Free cancellation up to 24h before tour start. Your payment is secure.</p>
      </div>

      {/* Pay Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button
          onClick={handlePay}
          disabled={createIntentMutation.isPending || confirmMutation.isPending}
          className="w-full h-14 rounded-2xl bg-[#3f6f60] hover:bg-[#2d5a4d] text-white font-bold text-base shadow-lg"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
          {createIntentMutation.isPending || confirmMutation.isPending ? "Processing..." : `Secure Payment — ${amount.toLocaleString()} VND`}
        </Button>
      </div>
    </div>
  );
}
