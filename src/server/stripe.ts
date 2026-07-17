import Stripe from "stripe";
import { config } from "./config";

/**
 * Lazy Stripe client — null while billing is dormant (no keys). Every
 * caller must handle null; that is the "disabled until credentials are
 * connected" contract in one place.
 */

let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  client = config.billing.enabled
    ? new Stripe(config.billing.stripeSecretKey!)
    : null;
  return client;
}

/** Resolve a catalog lookup key to a Stripe price id. */
export async function priceIdForLookupKey(lookupKey: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return prices.data[0]?.id ?? null;
}
