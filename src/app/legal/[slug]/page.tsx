import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import {
  getLegalDocument,
  LEGAL_DOCUMENT_LIST,
} from "@/lib/legal/documents";

interface LegalPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return LEGAL_DOCUMENT_LIST.map((doc) => ({
    slug: doc.slug,
  }));
}

export async function generateMetadata({
  params,
}: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDocument(slug);

  if (!doc) {
    return {
      title: "Policy Not Found | QC NetCore",
    };
  }

  return {
    title: `${doc.title} | QC NetCore Legal & Compliance`,
    description: doc.metaDescription,
  };
}

export default async function LegalDocumentPage({ params }: LegalPageProps) {
  const { slug } = await params;
  const doc = getLegalDocument(slug);

  if (!doc) {
    notFound();
  }

  return <LegalDocumentLayout document={doc} />;
}
