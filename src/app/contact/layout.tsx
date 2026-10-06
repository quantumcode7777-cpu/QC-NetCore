import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact & Support | QC NetCore ISP Operating System",
  description:
    "Contact QC NetCore via WhatsApp (0712052104) or Email (quantumcode7777@gmail.com) for ISP billing onboarding, technical support, legal inquiries, and security disclosure.",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
