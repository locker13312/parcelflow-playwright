const port = Number(process.env.PORT ?? 3000);

export const env = {
  port,
  baseUrl: process.env.BASE_URL ?? `http://localhost:${port}`,
  storageStatePath: '.auth/dispatcher.json',
  dispatcher: {
    email: process.env.DISPATCHER_EMAIL ?? 'dispatcher@parcelflow.test',
    password: process.env.DISPATCHER_PASSWORD ?? 'Passw0rd!',
    name: 'Dana Dispatcher',
  },
} as const;
