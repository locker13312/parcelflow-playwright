import { faker } from '@faker-js/faker';

export interface ShipmentInput {
  sender: string;
  recipient: string;
  address: string;
  weightKg: number;
}

/** Builds a valid shipment. Override only the fields a test cares about. */
export function buildShipment(overrides: Partial<ShipmentInput> = {}): ShipmentInput {
  return {
    sender: faker.company.name(),
    recipient: faker.person.fullName(),
    address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
    weightKg: faker.number.float({ min: 0.5, max: 30, fractionDigits: 1 }),
    ...overrides,
  };
}
