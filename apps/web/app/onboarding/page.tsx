"use client";

import { CreateOrganization, OrganizationList, useAuth, useUser } from "@clerk/nextjs";
import { Badge, Banner, Button, Icon, Logo, Stepper } from "@ledgerline/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { CompanyLimit, DataSources } from "@/components/app/AppPage";
import { BackendStatus } from "@/components/app/BackendStatus";
import { SetupNeeded } from "@/components/app/SetupNeeded";
import { useCompanyLimit, useWorkspace } from "@/components/app/useWorkspace";
import { clerkConfigured, convexConfigured } from "@/lib/config";

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
  const companyLimit = useCompanyLimit(workspace);
  const started = Boolean(workspace && (workspace.connection || workspace.lastSync || workspace.org.asOf));
  const step = !orgId ? 1 : started ? (workspace?.org.asOf ? 3 : 2) : 1;
  const fromXero = !workspace?.org.source || workspace.org.source === "xero";
  const { user } = useUser();
  // Onboarding is shown once: when someone reaches "Add your figures", later visits go straight to the app.
  // Their CSV import and the Xero callback open app pages, so this must be set before they leave.
  const reached = Boolean(orgId && workspace);
  useEffect(() => {
    if (reached && user && !user.unsafeMetadata.onboarded) void user.update({ unsafeMetadata: { ...user.unsafeMetadata, onboarded: true } }).catch(() => undefined);
  }, [reached, user]);

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
            { title: "Add your figures", hint: "Xero, CSV files or the sample" },
            { title: "Build your reports", hint: "About 2 minutes" },
            { title: "Check your figures", hint: "Every journal balanced" },
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
          ) : workspace && started ? (
            <>
              <h1>{workspace.org.asOf ? "You're all set" : fromXero ? "Your first sync is running" : "Your import is running"}</h1>
              <p>
                {workspace.org.asOf
                  ? fromXero
                    ? "Your figures are ready and have been checked against Xero."
                    : `Your figures from ${workspace.org.sourceLabel ?? "your file"} are ready. Every journal balanced.`
                  : fromXero
                    ? `Reading journals from ${workspace.connection?.tenantName ?? "Xero"}. This usually takes a couple of minutes.`
                    : `Storing journals from ${workspace.org.sourceLabel ?? "your file"}.`}
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
              <h1>Add your figures</h1>
              <p>Connect Xero for figures that stay current, import a chart of accounts and journals from CSV, or explore with the sample company. You can switch later.</p>
              {xeroError ? <Banner tone="negative" title="Xero wasn't connected.">{XERO_ERRORS[xeroError] ?? XERO_ERRORS.failed}</Banner> : null}
              {workspace ? <DataSources workspace={workspace} /> : companyLimit ? <CompanyLimit limit={companyLimit.limit} names={companyLimit.names} /> : <BackendStatus waiting />}
              <p className="ll-onb-trust">
                <Icon name="lock" size={16} />
                <span>
                  <strong>Read-only.</strong> Ledgerline reads your accounts, reports and transactions to build your figures. It never writes to Xero, moves money or
                  sees your bank login.
                </span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  if (!clerkConfigured || !convexConfigured) return <SetupNeeded />;
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}

