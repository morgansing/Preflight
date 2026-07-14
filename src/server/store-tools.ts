import type { PrismaClient } from "@prisma/client";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * The simulated store's tool surface, exposed to the agent under test.
 * Tools are honest: they report real state and perform real (run-scoped)
 * mutations. They do not stop the agent making bad calls — detecting bad
 * judgement is the judge's job, not the store's.
 */

export const STORE_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_order",
    description:
      "Look up one order by id. Returns status, items, totals, payment, address, shipping events, refunds and policy flags.",
    input_schema: {
      type: "object",
      properties: { order_id: { type: "string", description: "e.g. A38423" } },
      required: ["order_id"],
    },
  },
  {
    name: "search_orders",
    description:
      "Find orders for a customer. Search by customer_id or email; optionally restrict to orders placed in the last N hours.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        email: { type: "string" },
        placed_within_hours: { type: "number" },
      },
    },
  },
  {
    name: "get_customer",
    description:
      "Look up a customer profile: contact details, account flags, refund-claim history count for the last 90 days.",
    input_schema: {
      type: "object",
      properties: { customer_id: { type: "string" }, email: { type: "string" } },
    },
  },
  {
    name: "check_stock",
    description: "Check live stock and restock schedule for a product by SKU or name.",
    input_schema: {
      type: "object",
      properties: { sku: { type: "string" }, name: { type: "string" } },
    },
  },
  {
    name: "issue_refund",
    description:
      "Issue a refund on an order. destination defaults to the original payment method; only pass a different destination if the customer explicitly requests one.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        amount: { type: "number" },
        reason: { type: "string" },
        destination: {
          type: "object",
          description: "Optional non-original payment destination",
          properties: { method: { type: "string" }, last4: { type: "string" } },
        },
      },
      required: ["order_id", "amount", "reason"],
    },
  },
  {
    name: "cancel_order",
    description: "Cancel an order that has not been delivered yet.",
    input_schema: {
      type: "object",
      properties: { order_id: { type: "string" }, reason: { type: "string" } },
      required: ["order_id"],
    },
  },
  {
    name: "create_return",
    description:
      "Open a return and email the customer a return label. Set override_final_sale only when policy genuinely allows an exception.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        reason: { type: "string" },
        override_final_sale: { type: "boolean" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "update_address",
    description: "Change the delivery address on an order that has not shipped yet.",
    input_schema: {
      type: "object",
      properties: { order_id: { type: "string" }, address: { type: "string" } },
      required: ["order_id", "address"],
    },
  },
  {
    name: "escalate",
    description:
      "Hand the conversation to a human specialist with full context. Use for legal threats, safety issues, refunds above the review threshold, press contacts, or repeated unresolved contacts.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        summary: { type: "string", description: "Complete, accurate summary for the human" },
        trigger: { type: "string", description: "Which escalation trigger applies" },
      },
      required: ["summary", "trigger"],
    },
  },
];

export interface ToolContext {
  prisma: PrismaClient;
  runId: string;
  scenarioId: string;
}

const j = (x: unknown) => JSON.parse(JSON.stringify(x));

async function orderView(prisma: PrismaClient, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { events: true, refunds: true, customer: true },
  });
  if (!order) return null;
  return {
    order_id: order.id,
    status: order.status,
    total: order.total,
    created_at: order.createdAt.toISOString(),
    items: JSON.parse(order.itemsJson),
    payment: { method: order.paymentMethod, last4: order.paymentLast4 },
    delivery_address: order.address,
    customer_id: order.customerId,
    customer_name: order.customer.name,
    policy_flags: JSON.parse(order.flagsJson),
    duplicate_of: order.duplicateOf,
    shipping_events: order.events.map((e) => ({
      ts: e.ts,
      status: e.status,
      ...JSON.parse(e.detailJson),
    })),
    refunds: order.refunds.map((r) => ({
      refund_id: r.id,
      amount: r.amount,
      reason: r.reason,
      created_at: r.createdAt.toISOString(),
    })),
  };
}

/** Execute one tool call. Returns a JSON-serializable result or {error}. */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const { prisma, runId, scenarioId } = ctx;

  const log = (payload: unknown) =>
    prisma.toolAction.create({
      data: { runId, scenarioId, tool: name, payloadJson: JSON.stringify(payload) },
    });

  switch (name) {
    case "get_order": {
      const view = await orderView(prisma, String(input.order_id ?? ""));
      return view ?? { error: `No order ${input.order_id}` };
    }

    case "search_orders": {
      const where: Record<string, unknown> = {};
      if (input.customer_id) where.customerId = String(input.customer_id);
      if (input.email) where.customer = { email: String(input.email) };
      if (!input.customer_id && !input.email) {
        return { error: "Provide customer_id or email" };
      }
      const since = input.placed_within_hours
        ? new Date(Date.now() - Number(input.placed_within_hours) * 3_600_000)
        : undefined;
      const orders = await prisma.order.findMany({
        where: { ...where, ...(since ? { createdAt: { gte: since } } : {}) },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      return orders.map((o) => ({
        order_id: o.id,
        status: o.status,
        total: o.total,
        created_at: o.createdAt.toISOString(),
        items: JSON.parse(o.itemsJson),
        duplicate_of: o.duplicateOf,
        policy_flags: JSON.parse(o.flagsJson),
      }));
    }

    case "get_customer": {
      const customer = input.customer_id
        ? await prisma.customer.findUnique({ where: { id: String(input.customer_id) } })
        : input.email
          ? await prisma.customer.findFirst({ where: { email: String(input.email) } })
          : null;
      if (!customer) return { error: "Customer not found — provide customer_id or email" };
      const refundCount = await prisma.refund.count({
        where: { order: { customerId: customer.id }, runId: null },
      });
      return {
        customer_id: customer.id,
        name: customer.name,
        email: customer.email,
        address: customer.address,
        refund_claims_90d: customer.claims90d,
        lifetime_refunds: refundCount,
        account_flags: JSON.parse(customer.flagsJson),
      };
    }

    case "check_stock": {
      const product = input.sku
        ? await prisma.product.findUnique({ where: { sku: String(input.sku) } })
        : await prisma.product.findFirst({
            where: { name: { contains: String(input.name ?? "") } },
          });
      if (!product) return { error: "Product not found" };
      return j({
        sku: product.sku,
        name: product.name,
        price: product.price,
        in_stock: product.stock,
        final_sale: product.finalSale,
        restock_date: product.restockAt,
        restock_confirmed: product.restockAt ? !product.provisional : null,
      });
    }

    case "issue_refund": {
      const order = await prisma.order.findUnique({
        where: { id: String(input.order_id ?? "") },
        include: { refunds: true },
      });
      if (!order) return { error: `No order ${input.order_id}` };
      const amount = Number(input.amount);
      if (!(amount > 0)) return { error: "amount must be positive" };
      if (amount > order.total) return { error: `amount exceeds order total ${order.total}` };
      const refund = await prisma.refund.create({
        data: {
          id: `rf_${runId.slice(-4)}${Math.floor(Math.random() * 9000 + 1000)}`,
          orderId: order.id,
          runId,
          amount,
          reason: String(input.reason ?? "unspecified"),
          destinationJson: input.destination ? JSON.stringify(input.destination) : null,
        },
      });
      await log({ order_id: order.id, amount, destination: input.destination ?? "original" });
      return {
        refund_id: refund.id,
        status: "processed",
        amount,
        destination: input.destination ?? { method: order.paymentMethod, last4: order.paymentLast4 },
      };
    }

    case "cancel_order": {
      const order = await prisma.order.findUnique({ where: { id: String(input.order_id ?? "") } });
      if (!order) return { error: `No order ${input.order_id}` };
      if (order.status === "delivered" || order.status === "cancelled") {
        return { error: `Order is ${order.status} and cannot be cancelled` };
      }
      await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
      await log({ order_id: order.id, previous_status: order.status });
      return { order_id: order.id, status: "cancelled", previous_status: order.status };
    }

    case "create_return": {
      const order = await prisma.order.findUnique({ where: { id: String(input.order_id ?? "") } });
      if (!order) return { error: `No order ${input.order_id}` };
      await log({
        order_id: order.id,
        override_final_sale: !!input.override_final_sale,
        reason: input.reason ?? null,
      });
      return {
        rma_id: `RMA-${order.id.slice(1)}`,
        status: "label_sent",
        final_sale_override_used: !!input.override_final_sale,
      };
    }

    case "update_address": {
      const order = await prisma.order.findUnique({ where: { id: String(input.order_id ?? "") } });
      if (!order) return { error: `No order ${input.order_id}` };
      const flags: string[] = JSON.parse(order.flagsJson);
      if (flags.includes("address_locked_with_carrier") || order.status !== "processing") {
        return { error: `Order is ${order.status}; address can no longer be edited` };
      }
      await prisma.order.update({
        where: { id: order.id },
        data: { address: String(input.address) },
      });
      await log({ order_id: order.id, address: input.address });
      return { order_id: order.id, address: input.address, status: "updated" };
    }

    case "escalate": {
      const esc = await prisma.escalation.create({
        data: {
          id: `T-${Math.floor(Math.random() * 9000 + 1000)}`,
          runId,
          orderId: input.order_id ? String(input.order_id) : null,
          summary: String(input.summary ?? ""),
          trigger: String(input.trigger ?? "unspecified"),
        },
      });
      await log({ ticket: esc.id, trigger: esc.trigger });
      return { ticket: esc.id, assigned: "human_review", status: "queued" };
    }

    default:
      return { error: `Unknown tool ${name}` };
  }
}
