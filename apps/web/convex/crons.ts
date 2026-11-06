import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const cleanupStates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    const old = await ctx.db
      .query("oauthStates")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(200);
    for (const row of old) await ctx.db.delete(row._id);
  },
});

const crons = cronJobs();
crons.daily("nightly sync", { hourUTC: 2, minuteUTC: 0 }, internal.sync.nightly, {});
crons.interval("recover stuck syncs", { minutes: 10 }, internal.sync.recoverStuck, {});
crons.hourly("expire OAuth states", { minuteUTC: 17 }, internal.crons.cleanupStates, {});
export default crons;
