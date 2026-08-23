import { expect, test } from "@playwright/test";

test("analyst filters, reviews, and decides a case", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Disputes need judgment." })).toBeVisible();
  await expect(page.getByText("Synthetic demo data")).toBeVisible();
  await page.getByLabel("Search cases").fill("Northstar");
  await expect(page.getByText(/of 50/)).toBeVisible();
  await page.getByRole("row").nth(1).click();
  await page.getByRole("button", { name: "Generate recommendation" }).click();
  await expect(page.getByText("Demo recommendation generated and validated.")).toBeVisible();
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText(/Decision recorded:/)).toBeVisible();
});

test("keyboard navigation and case study remain available", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Product case study" }).click();
  await expect(page.getByRole("heading", { name: "Designing AI for accountable decisions" })).toBeVisible();
  await page.getByRole("button", { name: "Back to queue" }).click();
  await expect(page.getByRole("heading", { name: "Open cases" })).toBeVisible();
});
