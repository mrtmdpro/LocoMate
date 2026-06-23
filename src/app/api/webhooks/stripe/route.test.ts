import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { createExperience, createHost, createPayment, createTour, createUser } from "@/test/fixtures";
import { getTestDb } from "@/test/setup";
import { experiences, payments, tours } from "@/server/db/schema";
import type { db as prodDb } from "@/server/db";
import { handleStripeWebhookEvent } from "./route";

type ProdDb = typeof prodDb;

describe("Stripe webhook handling", () => {
  test("replaying payment_intent.succeeded is idempotent", async () => {
    const traveler = await createUser();
    const { user: hostUser } = await createHost();
    const exp = await createExperience({
      authorId: hostUser.id,
      kind: "host_custom",
      status: "published",
    });
    const tour = await createTour({
      userId: traveler.id,
      experienceId: exp.id,
      packageType: "host_experience",
      status: "preview",
    });
    const payment = await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      status: "pending",
      gatewayTxnId: "pi_webhook_success",
      paymentGateway: "stripe",
    });
    const event = {
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_webhook_success",
          metadata: { paymentId: payment.id },
          status: "succeeded",
        },
      },
    };

    const db = getTestDb() as unknown as ProdDb;
    await handleStripeWebhookEvent(event, db);
    await handleStripeWebhookEvent(event, db);

    const [paymentAfter] = await getTestDb()
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id));
    expect(paymentAfter.status).toBe("succeeded");

    const [tourAfter] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, tour.id));
    expect(tourAfter.status).toBe("paid");

    const [expAfter] = await getTestDb()
      .select()
      .from(experiences)
      .where(eq(experiences.id, exp.id));
    expect(expAfter.totalBookings).toBe(1);
  });

  test("payment_intent.payment_failed marks the payment failed without fulfilling", async () => {
    const traveler = await createUser();
    const tour = await createTour({ userId: traveler.id, status: "preview" });
    const payment = await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      status: "pending",
      gatewayTxnId: "pi_webhook_failed",
      paymentGateway: "stripe",
    });

    await handleStripeWebhookEvent(
      {
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_webhook_failed",
            metadata: { paymentId: payment.id },
            status: "requires_payment_method",
          },
        },
      },
      getTestDb() as unknown as ProdDb,
    );

    const [paymentAfter] = await getTestDb()
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id));
    expect(paymentAfter.status).toBe("failed");
    expect(paymentAfter.paidAt).toBeNull();

    const [tourAfter] = await getTestDb()
      .select()
      .from(tours)
      .where(eq(tours.id, tour.id));
    expect(tourAfter.status).toBe("preview");
  });

  test("payment_intent.succeeded must match the stored provider intent id", async () => {
    const traveler = await createUser();
    const tour = await createTour({ userId: traveler.id, status: "preview" });
    const payment = await createPayment({
      tourId: tour.id,
      userId: traveler.id,
      status: "pending",
      gatewayTxnId: "pi_expected",
      paymentGateway: "stripe",
    });

    await expect(
      handleStripeWebhookEvent(
        {
          type: "payment_intent.succeeded",
          data: {
            object: {
              id: "pi_wrong",
              metadata: { paymentId: payment.id },
              status: "succeeded",
            },
          },
        },
        getTestDb() as unknown as ProdDb,
      ),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/intent mismatch/i),
    });

    const [paymentAfter] = await getTestDb()
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id));
    expect(paymentAfter.status).toBe("pending");
  });
});
