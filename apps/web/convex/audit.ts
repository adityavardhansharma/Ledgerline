import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";
import { currentOrg } from "./lib/auth";

/** The append-only audit log, newest first. Nothing in Ledgerline updates or deletes these rows. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const found = await currentOrg(ctx);
    if (!found) return { page: [], isDone: true, continueCursor: "" };
    return ctx.db
      .query("auditEvents")
      .withIndex("by_org_at", (q) => q.eq("orgId", found.org._id))
      .order("desc")
      .paginate(paginationOpts);
  },
});
