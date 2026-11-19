import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
const b = await chromium.launch({ headless: true, chromiumSandbox: true });
const context = await b.newContext({ viewport: { width: 1440, height: 1100 } });
const p = await context.newPage();
try {
  await p.goto("http://127.0.0.1:4320", { waitUntil: "networkidle" });
  const report = [];
  for (const name of [
    "Overview",
    "Website companion",
    "Features",
    "Ask WebGuide",
    "Saved websites",
    "Run history",
    "Explorer",
    "Profile",
    "Settings",
    "FAQs",
    "Tutorials",
  ]) {
    await p
      .getByRole("navigation")
      .getByRole("button", { name, exact: name !== "Tutorials" })
      .click();
    const r = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    report.push({
      name,
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })),
      })),
    });
  }
  await fs.writeFile("artifacts/webguide-axe.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (report.some((page) => page.violations.length))
    throw new Error("Accessibility audit contains violations");
  await p.getByRole("navigation").getByRole("button", { name: "Overview", exact: true }).click();
  await p.screenshot({ path: "artifacts/webguide-home.png", fullPage: true });
} finally {
  await b.close();
}
