import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/Chrome";
import ReportView from "@/components/ReportView";
import { getLead } from "@/lib/leads";

export const dynamic = "force-dynamic";

// Reports are private links; keep them out of search engines.
export const metadata: Metadata = {
  title: "Your Practice Grader report | South Coast Marketing",
  robots: { index: false, follow: false },
};

export default async function SavedReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead?.report) notFound();

  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <ReportView report={lead.report} firstName={lead.firstName} reportId={lead.id} savedAt={lead.createdAt} />
      </main>
      <SiteFooter />
    </>
  );
}
