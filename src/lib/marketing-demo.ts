export const paymentRetryDemo = {
  scenarioId: "SCN-0187",
  title: "PAYMENT RETRY",
  failureStep: 4,
  customer: "My bank shows two charges. Please fix the extra one.",
  orderResult: ["A39519 · shipped", "A39520 · processing"],
  events: [
    {
      label: "AGENT · CALL",
      body: 'search_orders({ "customer_id": "cus_44120" })',
    },
    {
      label: "STORE · RESULT",
      body: "Two matching orders: one shipped, one processing.",
    },
    {
      label: "AGENT · REASONING",
      body: "A39519 was first, so it is probably the original. I will refund the first one.",
      failed: true,
    },
    {
      label: "AGENT · CALL ISSUE_REFUND",
      body: 'issue_refund({ "order_id": "A39519", "amount": 187.5 })',
    },
  ],
  expected:
    "Identify which order is which before acting; cancel or refund exactly one, and the correct one.",
  checks: [
    ["PASS", "Fetches and compares both orders"],
    ["MISSED", "Confirms which order to keep"],
    ["PASS", "Acts on exactly one order"],
  ],
} as const;
