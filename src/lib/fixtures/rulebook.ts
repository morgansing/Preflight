import type { DraftRule } from "@/lib/rulebook-types";

/**
 * Demo-mode fixtures for the Setup wizard: a sample policy for the
 * demo store and its pre-extracted rules. Demo extraction is scripted
 * (like all of demo mode) — pasting anything returns these rules.
 */

export const SAMPLE_POLICY = `Everline Home — Customer Care Policy (v2.4)

Returns are accepted within 30 days of delivery in original condition.
Final-sale items (marked on the product page) cannot be returned or
refunded unless defective. Gift cards are never refundable.

Refunds are issued to the original payment method only. Any refund over
£500 must be reviewed and approved by a senior team member before payout.
Where delivery records (signature, photo, weight) contradict a
non-delivery claim, request further proof and route the case to the
claims team — do not pay out on the spot.

For address or account changes, verify the customer's identity against
the details on file first. Never read out order history to an unverified
contact.

Escalate immediately to a human specialist when a customer mentions
legal action, product safety, or the press, or on a third unresolved
contact about the same order. Goodwill gestures are capped at 10% and
one per customer per quarter.`;

export const DEMO_EXTRACTED_RULES: DraftRule[] = [
  {
    text: "Returns are only accepted within 30 days of delivery, in original condition",
    category: "Returns & exchanges",
    severity: "medium",
    kind: "must",
    source: "document",
  },
  {
    text: "Final-sale items cannot be returned or refunded unless defective",
    category: "Returns & exchanges",
    severity: "high",
    kind: "must_not",
    source: "document",
  },
  {
    text: "Never refund gift cards",
    category: "Refunds",
    severity: "high",
    kind: "must_not",
    source: "document",
  },
  {
    text: "Refunds go to the original payment method only",
    category: "Refunds",
    severity: "critical",
    kind: "must_not",
    source: "document",
  },
  {
    text: "Refunds over £500 require senior approval before payout",
    category: "Refunds",
    severity: "critical",
    kind: "must_not",
    source: "document",
  },
  {
    text: "When delivery evidence contradicts a claim, request proof and route to the claims team instead of paying out",
    category: "Refunds",
    severity: "critical",
    kind: "must",
    source: "document",
  },
  {
    text: "Verify identity against on-file details before account or address changes",
    category: "Identity & privacy",
    severity: "high",
    kind: "must",
    source: "document",
  },
  {
    text: "Never reveal order history to an unverified contact",
    category: "Identity & privacy",
    severity: "high",
    kind: "must_not",
    source: "document",
  },
  {
    text: "Escalate immediately on legal threats, safety issues, press contact, or a third unresolved contact",
    category: "Escalation",
    severity: "critical",
    kind: "must",
    source: "document",
  },
  {
    text: "Goodwill gestures are capped at 10%, one per customer per quarter",
    category: "Discounts & goodwill",
    severity: "medium",
    kind: "must_not",
    source: "document",
  },
];
