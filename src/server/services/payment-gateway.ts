import Stripe from "stripe";

export type ProviderPaymentIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded";

export type ProviderPaymentIntent = {
  id: string;
  clientSecret: string | null;
  status: ProviderPaymentIntentStatus;
  metadata: Record<string, string>;
};

export type CreateProviderPaymentIntentInput = {
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
  description?: string;
};

export type PaymentProvider = {
  createPaymentIntent(
    input: CreateProviderPaymentIntentInput,
  ): Promise<ProviderPaymentIntent>;
  retrievePaymentIntent(id: string): Promise<ProviderPaymentIntent>;
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event;
};

function toProviderPaymentIntent(intent: Stripe.PaymentIntent): ProviderPaymentIntent {
  return {
    id: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status as ProviderPaymentIntentStatus,
    metadata: Object.fromEntries(
      Object.entries(intent.metadata ?? {}).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
  };
}

let providerForTests: PaymentProvider | null = null;
let stripeClient: Stripe | null = null;

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required to create payments");
  }
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

const stripePaymentProvider: PaymentProvider = {
  async createPaymentIntent(input) {
    const stripe = getStripeClient();
    const intent = await stripe.paymentIntents.create(
      {
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        description: input.description,
        metadata: input.metadata,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return toProviderPaymentIntent(intent);
  },

  async retrievePaymentIntent(id) {
    const intent = await getStripeClient().paymentIntents.retrieve(id);
    return toProviderPaymentIntent(intent);
  },

  constructWebhookEvent(payload, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is required to verify webhooks");
    }
    return getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  },
};

export function getPaymentProvider(): PaymentProvider {
  return providerForTests ?? stripePaymentProvider;
}

export function setPaymentProviderForTests(provider: PaymentProvider | null) {
  providerForTests = provider;
}

export type FakePaymentProvider = PaymentProvider & {
  getIntent(id: string): ProviderPaymentIntent | undefined;
  reset(): void;
  setIntent(intent: ProviderPaymentIntent): void;
  setIntentStatus(id: string, status: ProviderPaymentIntentStatus): void;
};

export function createFakePaymentProvider(options?: {
  defaultStatus?: ProviderPaymentIntentStatus;
}): FakePaymentProvider {
  const intents = new Map<string, ProviderPaymentIntent>();
  let sequence = 0;
  const defaultStatus = options?.defaultStatus ?? "succeeded";

  function syntheticIntent(id: string): ProviderPaymentIntent {
    return {
      id,
      clientSecret: `${id}_secret_fake`,
      status: defaultStatus,
      metadata: {},
    };
  }

  return {
    async createPaymentIntent(input) {
      sequence += 1;
      const id = `pi_fake_${sequence}`;
      const intent: ProviderPaymentIntent = {
        id,
        clientSecret: `${id}_secret_fake`,
        status: defaultStatus,
        metadata: input.metadata,
      };
      intents.set(id, intent);
      return intent;
    },

    async retrievePaymentIntent(id) {
      const existing = intents.get(id);
      if (existing) return existing;
      const fallback = syntheticIntent(id);
      intents.set(id, fallback);
      return fallback;
    },

    constructWebhookEvent(payload) {
      return JSON.parse(payload.toString()) as Stripe.Event;
    },

    getIntent(id) {
      return intents.get(id);
    },

    reset() {
      intents.clear();
      sequence = 0;
    },

    setIntent(intent) {
      intents.set(intent.id, intent);
    },

    setIntentStatus(id, status) {
      const existing = intents.get(id) ?? syntheticIntent(id);
      intents.set(id, { ...existing, status });
    },
  };
}
