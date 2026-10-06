import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

test("Legal documents data module defines all 10 required legal policies and verified contacts", () => {
  const src = readProjectFile("src/lib/legal/documents.ts");

  // Verified Contact Details
  assert.match(src, /quantumcode7777@gmail\.com/);
  assert.match(src, /0712052104/);
  assert.match(src, /https:\/\/wa\.me\/254712052104\?text=/);

  // All 10 required legal document slugs
  const expectedSlugs = [
    "terms",
    "privacy",
    "cookies",
    "acceptable-use",
    "refunds",
    "payment-terms",
    "sla",
    "data-protection",
    "security",
    "responsible-disclosure",
  ];

  for (const slug of expectedSlugs) {
    assert.ok(
      src.includes(`${slug}:`) || src.includes(`"${slug}":`),
      `Expected legal document slug '${slug}' to be defined in src/lib/legal/documents.ts`
    );
  }
});

test("Supported countries list contains all 22 specified countries", () => {
  const src = readProjectFile("src/lib/legal/documents.ts");

  const expectedCountries = [
    "Benin",
    "Burkina Faso",
    "Cameroon",
    "Côte d’Ivoire",
    "DR Congo",
    "Egypt",
    "Ghana",
    "India",
    "Kenya",
    "Malawi",
    "Nigeria",
    "Pakistan",
    "Republic of the Congo",
    "Rwanda",
    "Senegal",
    "Sierra Leone",
    "South Africa",
    "Tanzania",
    "Thailand",
    "Uganda",
    "Zambia",
    "Zimbabwe",
  ];

  for (const country of expectedCountries) {
    assert.ok(
      src.includes(`"${country}"`),
      `Expected country '${country}' to be present in SUPPORTED_COUNTRIES`
    );
  }
});

test("SiteFooter implements all 6 navigation columns, countries section, and legal links without dead anchors", () => {
  const footerSrc = readProjectFile("src/components/layout/SiteFooter.tsx");

  const requiredColumnTitles = [
    "Platform",
    "Network & Billing",
    "Services",
    "Resources",
    "Company",
    "Social / Community",
  ];

  for (const title of requiredColumnTitles) {
    assert.ok(
      footerSrc.includes(`title: "${title}"`),
      `Expected footer column '${title}' in SiteFooter.tsx`
    );
  }

  const requiredItems = [
    "Features",
    "Solutions",
    "Pricing",
    "Integrations",
    "Capacity",
    "PPPoE Billing",
    "Hotspot Billing",
    "Payment Reconciliation",
    "MikroTik Provisioning",
    "TR-069 Device Management",
    "Access",
    "WiFi Marketing",
    "Academy",
    "Shop",
    "Documentation",
    "Blog",
    "Changelog",
    "Live Demo",
    "Contact",
    "Affiliates",
    "Book a Call",
    "Sign In",
    "WhatsApp",
    "LinkedIn",
    "Instagram",
    "YouTube",
    "TikTok",
    "Facebook",
  ];

  for (const label of requiredItems) {
    assert.ok(
      footerSrc.includes(`label: "${label}"`),
      `Expected navigation link '${label}' in SiteFooter.tsx`
    );
  }

  // Ensure no dead href="#" links exist
  assert.ok(
    !footerSrc.includes('href: "#"') && !footerSrc.includes('href="#"'),
    "SiteFooter must not contain dead '#' links"
  );

  // Ensure Supported Countries block is removed from SiteFooter
  assert.ok(
    !footerSrc.includes("Countries Supported by the QC NetCore Platform Architecture"),
    "SiteFooter must not display the Supported Countries block"
  );
});

test("Landing page, Legal routes, Contact page, and CookieConsentBanner are properly wired", () => {
  const landingSrc = readProjectFile("src/app/page.tsx");
  const layoutSrc = readProjectFile("src/app/layout.tsx");
  const contactSrc = readProjectFile("src/app/contact/page.tsx");
  const legalDynamicSrc = readProjectFile("src/app/legal/[slug]/page.tsx");

  assert.ok(landingSrc.includes("<SiteFooter"), "Landing page must render <SiteFooter />");
  assert.ok(
    layoutSrc.includes("<CookieConsentBanner"),
    "Root layout must include <CookieConsentBanner />"
  );
  assert.ok(
    contactSrc.includes("LEGAL_CONTACT.whatsappLocal") &&
      contactSrc.includes("LEGAL_CONTACT.email"),
    "Contact page must display verified WhatsApp and Email contact endpoints"
  );
  assert.ok(
    legalDynamicSrc.includes("generateStaticParams") &&
      legalDynamicSrc.includes("generateMetadata"),
    "Legal dynamic route must export generateStaticParams and generateMetadata for SEO"
  );
});
