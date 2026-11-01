import type { Locator, Page } from '@playwright/test';
import type { ShipmentInput } from '../data/shipmentFactory';
import { BasePage } from './BasePage';

export class ShipmentsPage extends BasePage {
  readonly path = '/#/shipments';
  readonly sender: Locator;
  readonly recipient: Locator;
  readonly address: Locator;
  readonly weight: Locator;
  readonly submit: Locator;
  readonly formErrors: Locator;
  readonly statusFilter: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.sender = page.getByTestId('shipment-sender');
    this.recipient = page.getByTestId('shipment-recipient');
    this.address = page.getByTestId('shipment-address');
    this.weight = page.getByTestId('shipment-weight');
    this.submit = page.getByTestId('shipment-submit');
    this.formErrors = page.getByTestId('shipment-errors');
    this.statusFilter = page.getByTestId('status-filter');
    this.table = page.getByTestId('shipments-table');
    this.rows = page.getByTestId('shipment-row');
    this.emptyState = page.getByTestId('empty-state');
  }

  async createShipment(data: Partial<ShipmentInput>): Promise<void> {
    if (data.sender !== undefined) await this.sender.fill(data.sender);
    if (data.recipient !== undefined) await this.recipient.fill(data.recipient);
    if (data.address !== undefined) await this.address.fill(data.address);
    if (data.weightKg !== undefined) await this.weight.fill(String(data.weightKg));
    await this.submit.click();
  }

  fieldError(field: keyof ShipmentInput): Locator {
    return this.page.getByTestId(`error-${field}`);
  }

  row(trackingNumber: string): ShipmentRow {
    return new ShipmentRow(this.rows.filter({ has: this.page.getByText(trackingNumber, { exact: true }) }));
  }

  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption(status);
  }
}

/** A single table row. Keeps row-level selectors out of the tests. */
export class ShipmentRow {
  readonly recipient: Locator;
  readonly driver: Locator;
  readonly status: Locator;

  constructor(readonly root: Locator) {
    this.recipient = root.getByTestId('cell-recipient');
    this.driver = root.getByTestId('cell-driver');
    this.status = root.getByTestId('cell-status');
  }

  action(name: 'assign' | 'start' | 'deliver' | 'cancel'): Locator {
    return this.root.getByTestId(`action-${name}`);
  }

  async assignDriver(driver: string): Promise<void> {
    await this.root.getByTestId('driver-select').selectOption(driver);
    await this.action('assign').click();
  }
}
