"use client";

import { CreateOrganization, OrganizationList, useAuth } from "@clerk/nextjs";
import { Badge, Banner, Button, Icon, Logo, Panel, Stepper } from "@ledgerline/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ConnectButton } from "@/components/app/AppPage";
import { useWorkspace } from "@/components/app/useWorkspace";

const XERO_ERRORS: Record<string, string> = {
  access_denied: "Xero access was declined. Ledgerline needs read-only access to build your reports.",
  expired: "That Xero sign-in took too long. Please try again.",
  "no-organisation": "No Xero organisation was chosen. Pick one on Xero's screen.",
  failed: "Xero didn't accept the connection. Please try again.",
  cancelled: "The Xero connection was cancelled.",
};

function Onboarding() {
  const { orgId, isLoaded } = useAuth();
  const params = useSearchParams();
  const xeroError = params.get("xero");
  const workspace = useWorkspace();
  const step = !orgId ? 1 : workspace?.connection ? (workspace.org.asOf ? 3 : 2) : 1;

  return (
    <div className="ll-onb">
      <div className="ll-onb-top">
        <Logo size={26} />
        <Badge>Step {Math.min(step + 1, 4)} of 4</Badge>
      </div>
      <div className="ll-onb-body">
        <Stepper
          current={step}
          steps={[
            { title: "Create your account", hint: "Done" },
            { title: "Connect Xero", hint: "Read-only, one organisation" },
            { title: "First sync", hint: "About 2 minutes" },
            { title: "Check your figures", hint: "Compared with Xero" },
          ]}
        />
        <div className="ll-onb-main">
          {!isLoaded ? null : !orgId ? (
            <>
              <h1>Set up your organisation</h1>
              <p>Each Ledgerline organisation connects to one Xero organisation. Invite your accountant later from Settings.</p>
              <OrganizationList hidePersonal afterSelectOrganizationUrl="/onboarding" afterCreateOrganizationUrl="/onboarding" />
              <details>
                <summary style={{ cursor: "pointer", color: "var(--ink-muted)" }}>Create a new organisation instead</summary>
                <div style={{ marginTop: 12 }}>
                  <CreateOrganization afterCreateOrganizationUrl="/onboarding" skipInvitationScreen />
                </div>
              </details>
            </>
          ) : workspace?.connection ? (
            <>
              <h1>{workspace.org.asOf ? "You're all set" : "Your first sync is running"}</h1>
              <p>
                {workspace.org.asOf
                  ? "Your figures are ready and have been checked against Xero."
                  : `Reading journals from ${workspace.connection.tenantName}. This usually takes a couple of minutes.`}
              </p>
              <div className="ll-row">
                <Link href={workspace.org.asOf ? "/overview" : "/data/sync"}>
                  <Button variant="primary" size="lg" iconRight="arrow-right">
                    {workspace.org.asOf ? "Open your overview" : "Watch the sync"}
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1>Connect your Xero organisation</h1>
              <p>Ledgerline reads your journals, accounts and invoices to build your reports. You'll pick the organisation on Xero's own screen.</p>
              {xeroError ? <Banner tone="negative" title="Xero wasn't connected.">{XERO_ERRORS[xeroError] ?? XERO_ERRORS.failed}</Banner> : null}
              <Panel title="What Ledgerline can and can't do" icon="lock">
                <ul className="ll-perm">
                  <li><Icon name="check" size={18} /><span><strong>Read</strong> journals, accounts, invoices and reports</span></li>
                  <li><Icon name="check" size={18} /><span><strong>Get notified</strong> when an invoice changes, so reports stay current</span></li>
                  <li className="is-no"><Icon name="close" size={18} /><span><strong>Never write</strong> to Xero, create invoices or move money</span></li>
                  <li className="is-no"><Icon name="close" size={18} /><span><strong>Never see</strong> your bank login or payroll details</span></li>
                </ul>
              </Panel>
              <Banner tone="info" title="Trying it out?">Connect Xero's free Demo Company. It resets every 28 days; Ledgerline notices and resyncs on its own.</Banner>
              <div className="ll-row">
                <ConnectButton size="lg" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}

