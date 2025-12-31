import { test, expect, request as playwrightRequest } from '@playwright/test';

// const BASE_URL = 'https://club-administration.qa.qubika.com/#';
const API_BASE_URL = 'https://api.club-administration.qa.qubika.com';

const ROUTES = {
  login: '/#/auth/login',
  dashboard: '/#/dashboard',
  categoryTypes: '/#/category-type',
};

const UI_TEXT = {
  appTitle: 'Qubika Club',
  authenticate: 'Autenticar',
  dashboardLink: 'Dashboard',
  categoryTypesLink: 'Tipos de Categorias',
  addCategory: 'Adicionar',
  confirm: 'Aceptar',
  successToast: 'Tipo de categoría adicionada satisfactoriamente',
};

const SELECTORS = {
  toastMessage: '#toast-container .toast-message',
  paginationItem: '.page-item',
  modalContainer: 'mat-dialog-container',

  loginEmailInput: 'input[formcontrolname="email"][type="email"]',
  loginPasswordInput: 'input[formcontrolname="password"][type="password"]',

  categoryNameInput: '#input-username',
  subCategoryCheckbox: '#customCheckMain',
  parentCategoryDropdownInput:
    '[formcontrolname="categoryId"] input[type="text"]',

  tableRows: 'tbody tr',
  tableCells: 'td',
};

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

function loginLocators(page) {
  return {
    authenticateButton: page.getByRole('button', {
      name: UI_TEXT.authenticate,
    }),
    emailInput: page.locator(SELECTORS.loginEmailInput),
    passwordInput: page.locator(SELECTORS.loginPasswordInput),
    dashboardLink: page.getByRole('link', { name: UI_TEXT.dashboardLink }),
  };
}

function categoryTypesLocators(page) {
  return {
    categoryTypesLink: page.getByRole('link', {
      name: UI_TEXT.categoryTypesLink,
    }),
    addButton: page.getByRole('button', { name: UI_TEXT.addCategory }),
    modal: page.locator(SELECTORS.modalContainer),

    nameInput: page.locator(SELECTORS.categoryNameInput),
    confirmButton: page.getByRole('button', { name: UI_TEXT.confirm }),

    subCategoryCheckbox: page.locator(SELECTORS.subCategoryCheckbox),
    parentDropdownInput: page.locator(SELECTORS.parentCategoryDropdownInput),

    toast: page.locator(SELECTORS.toastMessage, {
      hasText: UI_TEXT.successToast,
    }),
    paginationItems: page.locator(SELECTORS.paginationItem),
  };
}

async function createApiContext() {
  // Isolated API request context for this suite.
  return playwrightRequest.newContext();
}

async function registerAdminUserViaApi(apiRequest, userData) {
  // Create an admin user through API so the UI flow is deterministic.
  const response = await apiRequest.post(`${API_BASE_URL}/api/auth/register`, {
    data: userData,
  });

  expect(response.ok()).toBeTruthy();
  return response;
}

async function loginViaUi(page, { email, password }) {
  const { authenticateButton, emailInput, passwordInput, dashboardLink } =
    loginLocators(page);

  // The base URL is configured globally in playwright.config.js (use.baseURL),
  await page.goto(ROUTES.login);

  // Validate login page is loaded and interactive.
  await expect(page).toHaveTitle(UI_TEXT.appTitle);
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(authenticateButton).toBeVisible();

  await expect(emailInput).toBeVisible();
  await emailInput.fill(email);

  await expect(passwordInput).toBeVisible();
  await passwordInput.fill(password);

  await authenticateButton.click();

  // Validate user is logged in.
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(dashboardLink).toBeVisible();
}

async function navigateToCategoryTypesPage(page) {
  const { categoryTypesLink } = categoryTypesLocators(page);

  await expect(categoryTypesLink).toBeVisible();
  await categoryTypesLink.click();

  await expect(page).toHaveURL(/\/category-type/);
  await expect(categoryTypesLink).toHaveClass(/active/);
}

async function expectSuccessToastToShowAndAutoDismiss(page) {
  const { toast } = categoryTypesLocators(page);

  // Validate it appears.
  await expect(toast).toBeVisible();

  // Validate it disappears (auto close).
  await expect(toast).toBeHidden({ timeout: 10000 });

  // Extra safety: ensure it's removed from DOM.
  await expect(toast).toHaveCount(0);
}

function lastPaginationPageButton(page) {
  // In this app the last page button is nth(-2). The last element is "Next".
  const { paginationItems } = categoryTypesLocators(page);
  return paginationItems.nth(-2);
}

async function goToLastPaginationPage(page) {
  const last = lastPaginationPageButton(page);
  await expect(last).toBeVisible();
  await last.click();
}

async function openAddCategoryDialog(page) {
  const { addButton, modal } = categoryTypesLocators(page);

  await expect(addButton).toBeVisible();
  await addButton.click();

  await expect(modal).toBeVisible();
  return modal;
}

function waitForCategoryCreateApiResponse(page) {
  // Wait for the POST that creates the category type (root or sub-category).
  return page.waitForResponse((resp) => {
    return (
      resp.url().includes('/category-type/create') &&
      resp.request().method() === 'POST'
    );
  });
}

async function createRootCategoryViaUi(page, { name }) {
  await openAddCategoryDialog(page);

  const { nameInput, confirmButton } = categoryTypesLocators(page);

  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);

  // Start waiting before clicking to avoid race conditions.
  const createResponsePromise = waitForCategoryCreateApiResponse(page);

  await expect(confirmButton).toBeVisible();
  await confirmButton.click();

  const resp = await createResponsePromise;
  expect(resp.status()).toBe(200);

  const body = await resp.json();
  expect(body.name).toBe(name);
  expect(body.id).toBeTruthy();

  return body;
}

async function createSubCategoryViaUi(page, { name, parentName }) {
  await openAddCategoryDialog(page);

  const { nameInput, confirmButton, subCategoryCheckbox, parentDropdownInput } =
    categoryTypesLocators(page);

  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);

  // Enable sub-category mode.
  await expect(subCategoryCheckbox).toBeVisible();
  await subCategoryCheckbox.click({ force: true });

  // Select parent category.
  await expect(parentDropdownInput).toBeVisible();
  await parentDropdownInput.fill(parentName);

  // Select highlighted option.
  await parentDropdownInput.press('Enter');

  const createResponsePromise = waitForCategoryCreateApiResponse(page);

  await expect(confirmButton).toBeVisible();
  await confirmButton.click({ force: true });

  const resp = await createResponsePromise;
  expect(resp.status()).toBe(200);

  const body = await resp.json();
  expect(body.name).toBe(name);
  expect(body.id).toBeTruthy();

  return body;
}

async function expectCategoryRowToMatchNameAndParent(page, { name, parent }) {
  // Validate both values on the same row to avoid matching old data.
  const row = page.locator(SELECTORS.tableRows, {
    has: page.locator(SELECTORS.tableCells, { hasText: name }),
  });

  await expect(row).toBeVisible();

  const cells = row.locator(SELECTORS.tableCells);

  // Column 0: Nombre, Column 1: Categoria Padre.
  await expect(cells.nth(0)).toHaveText(name);
  await expect(cells.nth(1)).toHaveText(parent);
}

async function expectCategoryNameToBeVisibleInTable(page, categoryName) {
  await expect(
    page.locator('tbody tr td', { hasText: categoryName })
  ).toBeVisible();
}

test.describe('Category Types E2E (UI + API)', () => {
  let apiRequest;
  let credentials;
  let rootCategoryName;
  let subCategoryName;

  const existingRootCategory = 'TestCategoryRoot';

  test.beforeAll(async () => {
    apiRequest = await createApiContext();

    const suffix = randomSuffix();
    const email = `email+${suffix}@playwrite.com`;
    const password = `password+${suffix}`;

    credentials = { email, password };
    rootCategoryName = `category+${suffix}`;
    subCategoryName = `sub-category+${suffix}`;

    await registerAdminUserViaApi(apiRequest, {
      email,
      password,
      roles: ['ROLE_ADMIN'],
    });
  });

  test.afterAll(async () => {
    // Release API request context resources (connections, cookies, etc.).
    await apiRequest?.dispose();
  });

  test('creates a root category and a sub-category, then validates them in the list', async ({
    page,
  }) => {
    await loginViaUi(page, credentials);
    await navigateToCategoryTypesPage(page);

    // Create root category via UI and validate the API response payload.
    const createdRoot = await createRootCategoryViaUi(page, {
      name: rootCategoryName,
    });
    expect(createdRoot.root).toBe(true);

    await expectSuccessToastToShowAndAutoDismiss(page);

    // Validate root category is visible in list (pagination last page).
    await goToLastPaginationPage(page);
    await expectCategoryNameToBeVisibleInTable(page, rootCategoryName);

    // Create sub-category and validate it in the list row (name + parent on the same row).
    await createSubCategoryViaUi(page, {
      name: subCategoryName,
      parentName: existingRootCategory,
    });

    await expectSuccessToastToShowAndAutoDismiss(page);

    await goToLastPaginationPage(page);
    await expectCategoryRowToMatchNameAndParent(page, {
      name: subCategoryName,
      parent: existingRootCategory,
    });
  });
});
