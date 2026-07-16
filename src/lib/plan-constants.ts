/**
 * Plan constants shared by client (billing UI) and server (free-grant
 * enforcement). Kept in its own module with no "use client" and no
 * imports so either side can use it safely.
 */

/** The free tier's one-time grant of simulations. Not a trial clock. */
export const FREE_SIMS = 250;
