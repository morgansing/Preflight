import { describe, expect, it } from "vitest";
import { computeBalance, periodKeyFor } from "./credit-math";

const grant = (delta: number, periodKey: string) => ({ delta, kind: "allowance_grant", periodKey });
const debit = (delta: number, periodKey: string) => ({ delta: -Math.abs(delta), kind: "run_debit", periodKey });
const pack = (delta: number) => ({ delta, kind: "pack_purchase", periodKey: null });

describe("credit math", () => {
  it("spends allowance before purchased tokens", () => {
    const b = computeBalance([grant(2000, "cal:2026-07"), pack(1000), debit(500, "cal:2026-07")], "cal:2026-07");
    expect(b).toEqual({
      allowanceRemaining: 1500,
      purchasedRemaining: 1000,
      total: 2500,
      periodUsed: 500,
      allowance: 2000,
    });
  });

  it("overflows into purchased tokens once the allowance is exhausted", () => {
    const b = computeBalance([grant(2000, "cal:2026-07"), pack(1000), debit(2600, "cal:2026-07")], "cal:2026-07");
    expect(b.allowanceRemaining).toBe(0);
    expect(b.purchasedRemaining).toBe(400);
    expect(b.total).toBe(400);
    expect(b.periodUsed).toBe(2600);
  });

  it("does not roll unused allowance into the next period", () => {
    const b = computeBalance(
      [grant(2000, "cal:2026-06"), debit(100, "cal:2026-06"), grant(2000, "cal:2026-07")],
      "cal:2026-07",
    );
    expect(b.allowanceRemaining).toBe(2000);
    expect(b.purchasedRemaining).toBe(0);
  });

  it("remembers purchased tokens consumed in earlier periods", () => {
    const b = computeBalance(
      [
        grant(1000, "cal:2026-06"),
        pack(5000),
        debit(3000, "cal:2026-06"), // 2000 came out of the pack
        grant(1000, "cal:2026-07"),
      ],
      "cal:2026-07",
    );
    expect(b.purchasedRemaining).toBe(3000);
    expect(b.total).toBe(4000);
  });

  it("handles the lifetime (free) period and adjustments", () => {
    const b = computeBalance(
      [grant(250, "lifetime"), debit(240, "lifetime"), { delta: 100, kind: "adjustment", periodKey: null }],
      "lifetime",
    );
    expect(b.allowanceRemaining).toBe(10);
    expect(b.purchasedRemaining).toBe(100);
    expect(b.total).toBe(110);
  });

  it("never returns negative balances", () => {
    const b = computeBalance([grant(100, "lifetime"), debit(500, "lifetime")], "lifetime");
    expect(b.allowanceRemaining).toBe(0);
    expect(b.purchasedRemaining).toBe(0);
    expect(b.total).toBe(0);
  });

  it("derives period keys", () => {
    expect(periodKeyFor("lifetime", new Date())).toBe("lifetime");
    expect(periodKeyFor("monthly", new Date("2026-07-17"))).toBe("cal:2026-07");
    expect(periodKeyFor("monthly", new Date("2026-07-17"), new Date("2026-08-03"))).toBe("sub:2026-08-03");
  });
});
