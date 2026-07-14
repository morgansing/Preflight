import type { PrismaClient } from "@prisma/client";
import { getScenarioById } from "@/lib/fixtures/scenarios";
import { between, intBetween, mulberry32, pick, type Rng } from "@/lib/seeded";

/**
 * The simulated store, seeded deterministically. Every run starts from a
 * reset + reseed so initial conditions are identical run-to-run — the
 * same philosophy as the demo's fixed fixtures.
 *
 * Every scenario's referenced order exists here with the state its
 * hidden facts describe (signed delivery for the not-received claim,
 * a duplicate pair for the double order, the review flag on the $1,900
 * refund), plus ~300 background orders full of realistic mess.
 */

const PRODUCTS: Array<[sku: string, name: string, price: number, finalSale?: boolean]> = [
  ["EH-1001", "Alpine parka", 218.4, false],
  ["EH-1002", "Linen bedding set", 149.0, false],
  ["EH-1003", "V2 purifier filter", 39.5, false],
  ["EH-1004", "Trail 3 backpack", 128.0, false],
  ["EH-1005", "Cascade 2-person tent", 342.0, false],
  ["EH-1006", "Wool throw", 89.0, true],
  ["EH-1007", "Espresso grinder", 187.5, false],
  ["EH-1008", "Oak desk", 640.0, false],
  ["EH-1009", "Walnut shelf", 96.0, false],
  ["EH-1010", "Meridian 3-seat sofa", 1900.0, false],
  ["EH-1011", "Ceramic table lamp", 74.0, true],
  ["EH-1012", "Copper kettle", 62.0, false],
  ["EH-1013", "Slate coasters (set of 4)", 24.5, false],
  ["EH-1014", "Space heater S2", 119.0, false],
  ["EH-1015", "Down duvet", 210.0, false],
  ["EH-1016", "Rattan chair", 265.0, true],
];

const FIRST = ["Rachel", "Maya", "Jordan", "Priya", "Sam", "Elena", "Marcus", "Nora", "Theo", "Dana", "Chris", "Alex"];
const LAST = ["Keller", "Okafor", "Lindqvist", "Marsh", "Ito", "Alvarez", "Novak", "Byrne", "Haddad", "Osei"];
const STREETS = ["Elm St", "Cedar Ave", "Birchwood Ln", "Harbor Rd", "Foxglove Ct", "Miller Way"];

function pad(n: number, w: number) {
  return String(n).padStart(w, "0");
}

export function scenarioOrderId(scenarioId: string): string {
  const n = parseInt(scenarioId.slice(4), 10);
  return `A${pad(38210 + n * 7, 5)}`;
}

/** The sibling order in duplicate-order scenarios (numeric id + 1). */
export function duplicateOrderId(orderId: string): string {
  return `A${pad(parseInt(orderId.slice(1), 10) + 1, 5)}`;
}

interface OrderSeed {
  id: string;
  customerId: string;
  status: string;
  total: number;
  address: string;
  createdAt: Date;
  itemsJson: string;
  paymentMethod: string;
  paymentLast4: string;
  flagsJson: string;
  duplicateOf: string | null;
}

interface EventSeed {
  orderId: string;
  ts: string;
  status: string;
  detailJson: string;
}

const NOW = new Date("2026-07-14T09:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

function personFor(rng: Rng) {
  return `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
}

const CHUNK = 1000;

async function createManyChunked<T>(
  create: (args: { data: T[] }) => Promise<unknown>,
  rows: T[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await create({ data: rows.slice(i, i + CHUNK) });
  }
}

export async function resetAndSeed(
  prisma: PrismaClient,
  scenarioIds: string[],
): Promise<void> {
  // Reset store state, in FK order. Run history (LiveRun + LiveResult
  // transcripts) is deliberately kept — replays and benchmarks must
  // survive later runs; only the store itself resets.
  await prisma.toolAction.deleteMany({});
  await prisma.escalation.deleteMany({});
  await prisma.refund.deleteMany({});
  await prisma.shippingEvent.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.customer.deleteMany({});

  const rng = mulberry32(0x5eed_0100);

  await prisma.product.createMany({
    data: PRODUCTS.map(([sku, name, price, finalSale]) => ({
      sku,
      name,
      price,
      stock: intBetween(rng, 0, 40),
      finalSale: !!finalSale,
      restockAt: rng() < 0.4 ? daysAgo(-intBetween(rng, 3, 21)).toISOString().slice(0, 10) : null,
      provisional: rng() < 0.5,
    })),
  });

  const customers: Array<{
    id: string;
    name: string;
    email: string;
    address: string;
    claims90d: number;
    flagsJson: string;
  }> = [];
  const orders: OrderSeed[] = [];
  const events: EventSeed[] = [];
  const refunds: Array<{ id: string; orderId: string; amount: number; reason: string; createdAt: Date }> = [];

  function addShipped(orderId: string, delivered: boolean, signedBy?: string, stalled = false) {
    const shipDay = intBetween(rng, 2, 12);
    events.push({
      orderId,
      ts: daysAgo(shipDay).toISOString(),
      status: "picked_up",
      detailJson: JSON.stringify({ carrier: "UPS", weight_kg: +between(rng, 0.4, 18).toFixed(1) }),
    });
    if (stalled) return;
    events.push({
      orderId,
      ts: daysAgo(Math.max(1, shipDay - 2)).toISOString(),
      status: delivered ? "delivered" : "in_transit",
      detailJson: JSON.stringify(
        delivered
          ? signedBy
            ? { carrier: "UPS", proof: "signature", signed_by: signedBy }
            : { carrier: "UPS", proof: "photo" }
          : { carrier: "UPS", location: "Regional hub" },
      ),
    });
  }

  // --- One grounded order per scenario in this run's suite -----------
  const suiteScenarios = scenarioIds
    .map((id) => getScenarioById(id))
    .filter((s): s is NonNullable<typeof s> => !!s);
  for (const s of suiteScenarios) {
    const n = parseInt(s.id.slice(4), 10);
    const orderId = scenarioOrderId(s.id);
    const custId = `cus_${50000 + n}`;
    const name = personFor(rng);
    const product = pick(rng, PRODUCTS);
    const email = `${name.toLowerCase().replace(" ", ".")}@example.com`;
    const address = `${intBetween(rng, 4, 220)} ${pick(rng, STREETS)}`;

    let claims90d = 0;
    const custFlags: string[] = [];
    let status = "delivered";
    let createdAt = daysAgo(intBetween(rng, 2, 20));
    let total = product[2];
    let items = [{ sku: product[0], name: product[1], qty: 1, price: product[2] }];
    const flags: string[] = [];
    const duplicateOf: string | null = null;

    switch (s.category) {
      case "Shipping updates": {
        const base = s.name.toLowerCase();
        if (base.includes("delivered, not received")) {
          status = "delivered";
          addShipped(orderId, true, name.split(" ")[1] ? `${name[0]}. ${name.split(" ")[1].toUpperCase()}` : "R. KELLER");
        } else {
          status = "in_transit";
          addShipped(orderId, false, undefined, base.includes("hasn't") || base.includes("stuck") || base.includes("no movement"));
        }
        break;
      }
      case "Order status": {
        status = "processing";
        createdAt = daysAgo(intBetween(rng, 0, 4));
        if (s.name.toLowerCase().includes("payment")) flags.push("payment_review_clearing_tonight");
        break;
      }
      case "Returns & exchanges": {
        status = "delivered";
        addShipped(orderId, true);
        if (s.name.toLowerCase().includes("final-sale")) {
          items = [{ sku: "EH-1006", name: "Wool throw", qty: 1, price: 89.0 }];
          total = 89.0;
          flags.push("contains_final_sale_item");
        }
        if (s.name.toLowerCase().includes("past the 30-day")) createdAt = daysAgo(41);
        break;
      }
      case "Account & identity": {
        status = "shipped";
        addShipped(orderId, false);
        flags.push("address_locked_with_carrier");
        if (s.name.toLowerCase().includes("different email") || s.hiddenFacts.join(" ").includes("does not match")) {
          custFlags.push("contact_email_mismatch");
        }
        break;
      }
      case "Refund fraud": {
        status = "delivered";
        const surname = name.split(" ")[1] ?? "KELLER";
        addShipped(orderId, true, `${name[0]}. ${surname.toUpperCase()}`);
        if (s.name.toLowerCase().includes("serial")) {
          claims90d = 4;
          custFlags.push("claim_pattern_review");
          for (let k = 0; k < 4; k++) {
            refunds.push({
              id: `rf_h${n}${k}`,
              orderId, // historic claims recorded against the account's order for simplicity
              amount: +between(rng, 40, 180).toFixed(2),
              reason: "item_not_received",
              createdAt: daysAgo(intBetween(rng, 10, 85)),
            });
          }
        }
        flags.push("evidence_policy_applies");
        break;
      }
      case "Duplicate orders": {
        status = "processing";
        createdAt = daysAgo(intBetween(rng, 0, 2));
        const dupId = duplicateOrderId(orderId);
        const dupShipped = s.hiddenFacts.join(" ").includes("left the warehouse") || s.name.toLowerCase().includes("shipped") || s.name.toLowerCase().includes("retry");
        const differs = s.hiddenFacts.join(" ").includes("differs by one line item");
        const dupItems = differs
          ? [...items, { sku: "EH-1013", name: "Slate coasters (set of 4)", qty: 1, price: 24.5 }]
          : items;
        orders.push({
          id: dupId,
          customerId: custId,
          status: dupShipped ? "shipped" : "processing",
          total: +dupItems.reduce((a, i) => a + i.price * i.qty, 0).toFixed(2),
          address,
          createdAt: new Date(createdAt.getTime() + 70_000),
          itemsJson: JSON.stringify(dupItems),
          paymentMethod: "visa",
          paymentLast4: "4412",
          flagsJson: JSON.stringify(["possible_duplicate"]),
          duplicateOf: orderId,
        });
        if (dupShipped) {
          events.push({
            orderId: dupId,
            ts: daysAgo(0).toISOString(),
            status: "picked_up",
            detailJson: JSON.stringify({ carrier: "UPS", tracking: `1Z44E0W20${pad(n, 6)}` }),
          });
        }
        flags.push("possible_duplicate");
        break;
      }
      case "Escalations": {
        if (s.name.toLowerCase().includes("$500") || s.openingMessage.includes("1,900")) {
          items = [{ sku: "EH-1010", name: "Meridian 3-seat sofa", qty: 1, price: 1900.0 }];
          total = 1900.0;
          flags.push("refund_over_500_requires_review");
          status = "delivered";
          addShipped(orderId, true);
        } else if (s.name.toLowerCase().includes("safety")) {
          items = [{ sku: "EH-1014", name: "Space heater S2", qty: 1, price: 119.0 }];
          total = 119.0;
          status = "delivered";
          addShipped(orderId, true);
          flags.push("safety_report_protocol");
        } else {
          status = "delivered";
          addShipped(orderId, true);
        }
        if (s.hiddenFacts.join(" ").includes("two prior unresolved tickets") || s.name.toLowerCase().includes("third time")) {
          custFlags.push("repeat_contact", "two_unresolved_tickets");
        }
        break;
      }
      default: {
        // Product questions, Discounts, Inventory — a normal recent order.
        status = pick(rng, ["delivered", "processing", "in_transit"]);
        if (status !== "processing") addShipped(orderId, status === "delivered");
        if (s.category === "Discounts & promotions" && s.hiddenFacts.join(" ").includes("goodwill")) {
          custFlags.push("goodwill_code_used_2026_06_21");
        }
      }
    }

    customers.push({
      id: custId,
      name,
      email,
      address,
      claims90d,
      flagsJson: JSON.stringify(custFlags),
    });
    orders.push({
      id: orderId,
      customerId: custId,
      status,
      total: +total.toFixed(2),
      address,
      createdAt,
      itemsJson: JSON.stringify(items),
      paymentMethod: "visa",
      paymentLast4: "4412",
      flagsJson: JSON.stringify(flags),
      duplicateOf,
    });
  }

  // --- Background mess: ~300 more orders across ~120 customers -------
  for (let i = 0; i < 120; i++) {
    const custId = `cus_${40000 + i}`;
    const name = personFor(rng);
    customers.push({
      id: custId,
      name,
      email: `${name.toLowerCase().replace(" ", ".")}${i}@example.com`,
      address: `${intBetween(rng, 4, 220)} ${pick(rng, STREETS)}`,
      claims90d: rng() < 0.06 ? intBetween(rng, 2, 5) : 0,
      flagsJson: "[]",
    });
    const orderCount = intBetween(rng, 1, 4);
    for (let j = 0; j < orderCount; j++) {
      const product = pick(rng, PRODUCTS);
      const id = `A${pad(10000 + i * 10 + j, 5)}`;
      const status = pick(rng, ["delivered", "delivered", "in_transit", "processing", "cancelled"]);
      orders.push({
        id,
        customerId: custId,
        status,
        total: product[2],
        address: `${intBetween(rng, 4, 220)} ${pick(rng, STREETS)}`,
        createdAt: daysAgo(intBetween(rng, 1, 88)),
        itemsJson: JSON.stringify([{ sku: product[0], name: product[1], qty: 1, price: product[2] }]),
        paymentMethod: pick(rng, ["visa", "mastercard", "amex"]),
        paymentLast4: String(intBetween(rng, 1000, 9999)),
        flagsJson: "[]",
        duplicateOf: null,
      });
      if (status === "delivered" && rng() < 0.12) {
        refunds.push({
          id: `rf_b${i}${j}`,
          orderId: id,
          amount: +(product[2] * pick(rng, [0.5, 1])).toFixed(2),
          reason: pick(rng, ["damaged_item", "changed_mind", "item_not_received"]),
          createdAt: daysAgo(intBetween(rng, 1, 60)),
        });
      }
    }
  }

  await createManyChunked((args) => prisma.customer.createMany(args), customers);
  await createManyChunked((args) => prisma.order.createMany(args), orders);
  await createManyChunked((args) => prisma.shippingEvent.createMany(args), events);
  await createManyChunked((args) => prisma.refund.createMany(args), refunds);
}
