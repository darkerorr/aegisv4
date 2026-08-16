/**
 * Navbar link verification test.
 * Run with: npx tsx apps/web/src/__tests__/links.test.ts
 *
 * Tests that all navbar links point to valid routes.
 */

const requiredLinks = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Web" },
  { href: "/download", label: "Download" },
  { href: "/docs", label: "Documentation" },
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Create account" },
  { href: "/models", label: "Models" },
  { href: "/providers", label: "Providers" },
];

// Verify all required links are present in the SiteNav component
import { readFileSync } from "fs";
import { resolve } from "path";

const navPath = resolve(__dirname, "../components/SiteNav.tsx");
const navContent = readFileSync(navPath, "utf-8");

let passed = 0;
let failed = 0;

for (const link of requiredLinks) {
  // Check that href appears in the component
  if (navContent.includes(`href="${link.href}"`)) {
    console.log(`✓ ${link.label} -> ${link.href}`);
    passed++;
  } else {
    console.log(`✗ MISSING: ${link.label} -> ${link.href}`);
    failed++;
  }
}

// Verify no href="#" exists
if (navContent.includes('href="#"')) {
  console.log(`✗ Found placeholder href="#"`);
  failed++;
} else {
  console.log(`✓ No href="#" placeholders`);
  passed++;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
