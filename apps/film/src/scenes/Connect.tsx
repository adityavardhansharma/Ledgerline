import { Button, Icon, ReconcileCheck, StatusPill, SyncProgress } from "@ledgerline/ui";
import { Aurora, Chapter, Cursor, useAnchors, Words } from "../lib/fx";
import { backOut, clamp, expoOut, prog, spring, useT } from "../lib/time";

const SCOPES: Array<[string, string]> = [
  ["journal", "Journals and accounts"],
  ["invoice", "Invoices and contacts"],
  ["statement", "Profit and Loss, Balance Sheet"],
];

/** 19–30s: connect Xero, read-only; the sync runs; every account checked against Xero to the cent. */
export function Connect() {
  const t = useT();
  const a = useAnchors();
  const click1 = 2.2;
  const click2 = 4.85;
  const sources = 1 - prog(t, 3.0, 3.4);
  const consent = prog(t, 2.9, 3.5, expoOut) * (1 - prog(t, 5.4, 5.8));
  const sync = prog(t, 5.6, 6.2, expoOut) * (1 - prog(t, 9.2, 9.6));
  const phase = t < 6.5 ? 0 : t < 7.9 ? 1 : t < 8.3 ? 2 : t < 8.7 ? 3 : 4;
  const journals = Math.round(2412 * prog(t, 6.4, 7.9, (p) => p));
  const pages = Math.round(25 * prog(t, 5.8, 9.0, (p) => p));
  const recon1 = spring(t, 9.3, { stiffness: 160, damping: 14 });
  const recon2 = spring(t, 9.65, { stiffness: 160, damping: 14 });
  const leftA = 1 - prog(t, 8.7, 9.1);
  const out = prog(t, 10.5, 11);
  return (
    <div className="fx-scene" style={{ opacity: 1 - out }}>
      <Aurora strength={0.7} />
      <Chapter n="01" name="Connect" at={0.2} />
      <div className="cn-left">
        <div style={{ opacity: leftA, filter: `blur(${(1 - leftA) * 10}px)` }}>
          <div className="t-huge">
            <Words text="Connect Xero." at={0.3} stagger={0.1} />
          </div>
          <div className="t-mid cn-muted">
            <Words text="Or drop in a CSV." at={1.0} stagger={0.08} />
          </div>
          <p className="t-small cn-p" style={{ opacity: prog(t, 5.8, 6.6) }}>
            Read-only access. Tokens encrypted, never sent to your browser. First report in about two minutes.
          </p>
        </div>
        <div className="cn-cent" style={{ opacity: 1 - leftA }}>
          <div className="t-huge">
            <Words text="Matches Xero" at={8.9} stagger={0.08} />
            <br />
            <Words text="*to the cent.*" at={9.3} stagger={0.12} />
          </div>
          <p className="t-small cn-p" style={{ opacity: prog(t, 9.9, 10.4) }}>
            After every sync, each account is compared with Xero&apos;s own reports, month by month.
          </p>
        </div>
      </div>

      <div className="cn-stage-pos"><div className="cn-stage">
        {sources > 0 ? (
          <div className="cn-sources" style={{ opacity: sources * prog(t, 0.4, 1.0), transform: `translateY(${(1 - prog(t, 0.4, 1.2, expoOut)) * 60}px) scale(${1 - (1 - sources) * 0.05})` }}>
            <div className="ll-sources">
              <div className={`ll-source${t > 1.6 ? " cn-hot" : ""}`}>
                <h3>
                  <span className="ll-source-icon"><Icon name="plug" size={16} /></span>Connect Xero
                </h3>
                <p>Read-only access to one Xero organisation. Synced nightly and checked against Xero to the cent.</p>
                <div className="cn-btn" ref={a.ref("connect")} style={{ transform: `scale(${t > click1 && t < click1 + 0.15 ? 0.96 : 1})` }}>
                  <Button variant="primary" icon="link" size="sm" loading={t > click1}>
                    Connect Xero
                  </Button>
                </div>
              </div>
              <div className="ll-source">
                <h3>
                  <span className="ll-source-icon"><Icon name="upload" size={16} /></span>Import from CSV
                </h3>
                <p>A chart of accounts and a journal listing from any accounting system or spreadsheet.</p>
                <div>
                  <Button size="sm" icon="upload">Choose files</Button>
                </div>
              </div>
              <div className="ll-source">
                <h3>
                  <span className="ll-source-icon"><Icon name="database" size={16} /></span>Try the sample company
                </h3>
                <p>Kestrel Joinery Ltd, an Irish joinery: five years of books, every statement tying out.</p>
                <div>
                  <Button size="sm">Load sample</Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {consent > 0 ? (
          <div className="cn-consent film-card" style={{ opacity: consent, transform: `translateY(${(1 - consent) * 40}px) scale(${0.96 + consent * 0.04})` }}>
            <div className="cn-consent-head">
              <span className="cn-xero">x</span>
              <Icon name="arrow-right" size={18} />
              <span className="cn-ll"><Icon name="trend-up" size={20} /></span>
            </div>
            <h3>Ledgerline would like to read Kestrel Joinery Ltd</h3>
            <ul>
              {SCOPES.map(([icon, label], i) => (
                <li key={label} style={{ opacity: prog(t, 3.3 + i * 0.15, 3.7 + i * 0.15), transform: `translateX(${(1 - prog(t, 3.3 + i * 0.15, 3.8 + i * 0.15, expoOut)) * -16}px)` }}>
                  <Icon name={icon as never} size={18} />
                  <span>{label}</span>
                  <StatusPill status="matched">Read only</StatusPill>
                </li>
              ))}
            </ul>
            <div className="cn-cannot" style={{ opacity: prog(t, 3.9, 4.3) }}>
              <Icon name="lock" size={16} /> It can&apos;t create invoices, post journals or move money.
            </div>
            <div className="cn-consent-foot">
              <Button variant="ghost">Cancel</Button>
              <span ref={a.ref("allow")} style={{ display: "inline-block", transform: `scale(${t > click2 && t < click2 + 0.15 ? 0.95 : 1})` }}>
                <Button variant="primary" icon="check" loading={t > click2 + 0.1}>Allow read-only access</Button>
              </span>
            </div>
          </div>
        ) : null}

        {sync > 0 ? (
          <div className="cn-sync film-card" style={{ opacity: sync, transform: `translateY(${(1 - sync) * 40}px)` }}>
            <SyncProgress org="Kestrel Joinery Ltd" pagesDone={pages} pagesTotal={25} journals={journals} eta={pages < 25 ? `${Math.max(1, Math.round((25 - pages) * 3.5))} seconds` : undefined} phase={phase} />
          </div>
        ) : null}

        {t > 9.2 ? (
          <div className="cn-recon">
            <div style={{ opacity: clamp(recon1 * 2), transform: `scale(${0.8 + recon1 * 0.2}) translateY(${(1 - recon1) * 30}px)` }} className="cn-recon-item film-glow-brand">
              <ReconcileCheck status="match" report="P&L" checkedAt="07:02" lines={13} />
            </div>
            <div style={{ opacity: clamp(recon2 * 2), transform: `scale(${0.8 + recon2 * 0.2}) translateY(${(1 - recon2) * 30}px)` }} className="cn-recon-item film-glow-brand">
              <ReconcileCheck status="match" report="Balance Sheet" checkedAt="07:02" lines={21} />
            </div>
            <div className="cn-stamp" style={{ opacity: prog(t, 9.9, 10.1), transform: `rotate(-8deg) scale(${1.6 - 0.6 * backOut(clamp((t - 9.9) / 0.35))})` }}>
              €0.00 difference
            </div>
          </div>
        ) : null}
      </div></div>

      <Cursor
        path={[
          [0.9, 1700, 980],
          [1.9, ...a.at("connect")],
          [2.4, ...a.at("connect")],
          [4.5, ...a.at("allow")],
          [5.2, ...a.at("allow")],
        ]}
        clicks={[click1, click2]}
        hideAt={5.3}
      />
    </div>
  );
}

