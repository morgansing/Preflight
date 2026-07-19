import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/server/config";
import { applyStripeEvent } from "@/server/billing";
import { getStripe } from "@/server/stripe";
import { log, routeError } from "@/server/log";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook: signature-verified against the raw body, idempotent
 * via the StripeEvent table. Registered event types (docs/PRODUCTION.md):
 * checkout.session.completed, customer.subscription.created/updated/
 * deleted, invoice.paid, invoice.payment_failed.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe || !config.billing.stripeWebhookSecret) {
    return NextResponse.json({ error: "Billing is not connected." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event;
  try {
    const raw = await request.text();
    event = stripe.webhooks.constructEvent(raw, signature, config.billing.stripeWebhookSecret);
  } catch (err) {
    log.warn("billing.webhook", "signature verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const applied = await applyStripeEvent(event as never);
    return NextResponse.json({ received: true, applied });
  } catch (err) {
    return NextResponse.json(routeError("billing.webhook", err), { status: 500 });
  }
}
