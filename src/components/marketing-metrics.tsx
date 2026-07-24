"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Eyebrow } from "./ui";

const METRICS = [
  {
    value: "194",
    label: "scenarios handled correctly",
    width: "97%",
    tone: "var(--color-accent)",
  },
  {
    value: "4",
    label: "would have reached customers",
    width: "2%",
    tone: "var(--color-fail)",
  },
  {
    value: "2",
    label: "resolved, but off-policy",
    width: "1%",
    tone: "var(--color-warn)",
  },
];

export function MarketingMetrics() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: false, amount: 0.52 }}
      variants={{
        hidden: { opacity: 0.55, y: 18 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { staggerChildren: 0.12, duration: 0.5 },
        },
      }}
      className="rounded-2xl border border-edge bg-[linear-gradient(145deg,rgba(26,29,35,.94),rgba(15,17,20,.97))] p-7 shadow-[0_26px_70px_rgba(0,0,0,.28)] sm:p-9"
    >
      <div className="flex items-center justify-between">
        <Eyebrow>One run · this morning</Eyebrow>
        <motion.span
          animate={
            reduceMotion
              ? undefined
              : {
                  boxShadow: [
                    "0 0 0 rgba(240,84,79,0)",
                    "0 0 28px rgba(240,84,79,.12)",
                    "0 0 0 rgba(240,84,79,0)",
                  ],
                }
          }
          transition={{ duration: 3.2, repeat: Infinity }}
          className="rounded-full border border-fail/20 bg-fail/5 px-2.5 py-1 font-mono text-[9px] tracking-wider text-fail"
        >
          4 BLOCKERS
        </motion.span>
      </div>
      <div className="mt-8 space-y-6">
        {METRICS.map((metric) => (
          <motion.div
            key={metric.label}
            variants={{
              hidden: { opacity: 0, x: 16 },
              visible: { opacity: 1, x: 0 },
            }}
          >
            <div className="flex items-baseline gap-4">
              <motion.span
                className="numeral w-14 text-right text-4xl"
                style={{ color: metric.tone }}
                variants={{
                  hidden: { opacity: 0.25, scale: 0.92 },
                  visible: { opacity: 1, scale: 1 },
                }}
              >
                {metric.value}
              </motion.span>
              <span className="text-sm text-sub">{metric.label}</span>
            </div>
            <div className="ml-[4.5rem] mt-2 h-1 overflow-hidden rounded-full bg-edge">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{ width: metric.width, backgroundColor: metric.tone }}
                variants={{
                  hidden: { scaleX: 0 },
                  visible: {
                    scaleX: 1,
                    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
