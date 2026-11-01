import { z } from 'zod';

export const shipmentStatuses = ['created', 'assigned', 'in_transit', 'delivered', 'cancelled'] as const;
export type ShipmentStatus = (typeof shipmentStatuses)[number];

const historyItem = z.object({
  status: z.enum(shipmentStatuses),
  at: z.iso.datetime(),
});

export const shipmentSchema = z.strictObject({
  id: z.uuid(),
  trackingNumber: z.string().regex(/^PF-\d{6}$/),
  sender: z.string().min(1),
  recipient: z.string().min(1),
  address: z.string().min(1),
  weightKg: z.number().positive(),
  status: z.enum(shipmentStatuses),
  driver: z.string().nullable(),
  createdAt: z.iso.datetime(),
  history: z.array(historyItem).min(1),
});

export const trackingSchema = z.strictObject({
  trackingNumber: shipmentSchema.shape.trackingNumber,
  status: z.enum(shipmentStatuses),
  history: z.array(historyItem).min(1),
});

export const loginSchema = z.strictObject({
  token: z.uuid(),
  user: z.strictObject({ email: z.email(), name: z.string() }),
});

export const validationErrorSchema = z.strictObject({
  error: z.literal('Validation failed'),
  details: z.array(z.strictObject({ field: z.string(), message: z.string() })).min(1),
});

export const errorSchema = z.strictObject({ error: z.string() });

export type Shipment = z.infer<typeof shipmentSchema>;
