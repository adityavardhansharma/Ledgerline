"use client";

import { Icon } from "@ledgerline/ui";
import { DOORS_SEPTEMBER } from "./aiSamples";

/** Small, still pieces of the product: one figure opened to its journals, and a page of the board pack. */

/** A line of the profit and loss opened into the journal lines behind it, checked against Xero. */
export function TrustWidget() {
  return (
    <div className="lp-trust-card">
      <div className="lp-trust-cap">Profit and loss · September 2026</div>
      <div className="lp-trust-line is-faint">
        <span>Sales: fitted kitchens</span>
        <span>114,216</span>
      </div>
      <div className="lp-trust-line is-open">
        <span>
          <Icon name="chevron-down" size={14} /> Sales: doors and joinery
        </span>
        <span>132,064</span>
      </div>
      <ul className="lp-journals">
        {DOORS_SEPTEMBER.map((line) => (
          <li key={line.journal}>
            <span className="lp-journal-no">{line.journal}</span>
            <span>{line.date.replace(" 2026", "")}</span>
            <span>{line.description.split(":")[0]}</span>
            <span>{line.credit.toLocaleString("en-IE", { minimumFractionDigits: 2 })}</span>
          </li>
        ))}
        <li className="lp-journals-total">
          <span />
          <span />
          <span>3 lines</span>
          <span>132,064.37</span>
        </li>
      </ul>
      <div className="lp-trust-line is-faint">
        <span>Timber and materials</span>
        <span>(117,916)</span>
      </div>
      <div className="lp-stamp">
        <Icon name="reconcile" size={15} />
        <span>
          <b>Matches Xero&apos;s P&amp;L to the cent</b> · 13 accounts checked at 07:02
        </span>
      </div>
    </div>
  );
}

/** The first page of a board pack, on ruled paper, with one citation opened. */
export function BoardWidget() {
  return (
    <div className="lp-paper">
      <div className="lp-paper-head">
        <span>Board pack · September 2026</span>
        <span className="lp-paper-status">
          <Icon name="check" size={12} /> Accepted
        </span>
      </div>
      <div className="lp-paper-body">
        <div className="lp-paper-title">At a glance</div>
        <ul className="lp-glance">
          <li>
            September revenue was <span className="ll-cite">€246,281</span>, up <span className="ll-cite">16.9%</span> on August.
          </li>
          <li>
            Cash fell <span className="ll-cite">€50,497</span> in a profitable month, as customers paid later.
          </li>
          <li>
            Glenmore Developments was <span className="lp-cite-open ll-cite">43%</span> of recent sales.
            <span className="lp-cite-tip" role="note">
              <b>Sales by customer</b> Invoices, July to September 2026
            </span>
          </li>
        </ul>
        <div className="lp-paper-title">Risks</div>
        <div className="lp-risks">
          <span className="is-red">Customer concentration</span>
          <span className="is-amber">Collection risk</span>
          <span className="is-green">Liquidity headroom</span>
        </div>
      </div>
    </div>
  );
}
