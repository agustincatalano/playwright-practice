# Playwright practice

This repository contains a single end-to-end test that covers a full UI flow and validates the matching backend API response.

What the test does

- Creates an admin user via API to make the UI flow deterministic.
- Logs in through the UI.
- Navigates to the Category Types page.
- Creates a root category through the UI and validates the POST response payload.
- Creates a sub-category linked to an existing root category and validates it in the table.

How to run

- Install dependencies:
  npm ci

- Run the Playwright UI runner (headed):
  npx playwright test --headed --ui

- Run only this test file:
  npx playwright test tests/practice-e2e-playwright.spec.js --headed --ui

Formatting

- Format all files:
  npm run format

- Check formatting:
  npm run format:check
