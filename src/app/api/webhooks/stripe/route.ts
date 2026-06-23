import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getPaymentProvider } from "@/server/services/payment-gateway";
import {
  finalizeSucceededPayment,
  markProviderPaymentFailed,
} from "@/server/services/payment-finalization";

export const runtime = "nodejs";

type StripeIntentLike = {
  id?: string;
  metadata?: Record<string, string | undefined>;
  status?: string;
};

type StripeWebhookEventLike = {
  type: string;
  data: { object: StripeIntentLike };
};

type FinalizationDb = Parameters<typeof finalizeSucceededPayment>[0];

function paymentIdFromIntent(intent: StripeIntentLike) {
  return intent.metadata?.paymentId ?? intent.metadata?.locomatePaymentId ?? null;
}

export async function handleStripeWebhookEvent(
  event: StripeWebhookEventLike,
  database: FinalizationDb = db,
) {
  const intent = event.data.object;
  const paymentId = paymentIdFromIntent(intent);
  if (!paymentId) return { received: true, ignored: true };

  if (event.type === "payment_intent.succeeded") {
    if (!intent.id) return { received: true, ignored: true };
    await finalizeSucceededPayment(database, paymentId, intent.id);
    return { received: true };
  }

  if (
    event.type === "payment_intent.payment_failed" ||
    event.type === "payment_intent.canceled"
  ) {
    await markProviderPaymentFailed(database, paymentId);
    return { received: true };
  }

  return { received: true, ignored: true };
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: StripeWebhookEventLike;
  try {
    const payload = await req.text();
    event = getPaymentProvider().constructWebhookEvent(
      payload,
      signature,
    ) as StripeWebhookEventLike;
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook" }, { status: 400 });
  }

  await handleStripeWebhookEvent(event, db);
  return NextResponse.json({ received: true });
}
