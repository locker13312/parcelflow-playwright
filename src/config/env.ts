const port = Number(process.env.PORT ?? 3000);
const grpcPort = Number(process.env.GRPC_PORT ?? 50051);

export const env = {
  port,
  grpcPort,
  grpcAddress: process.env.GRPC_ADDRESS ?? `localhost:${grpcPort}`,
  baseUrl: process.env.BASE_URL ?? `http://localhost:${port}`,
  /** PostgreSQL checks run only when this is set. */
  databaseUrl: process.env.DATABASE_URL,
  storageStatePath: '.auth/dispatcher.json',
  dispatcher: {
    email: process.env.DISPATCHER_EMAIL ?? 'dispatcher@parcelflow.test',
    password: process.env.DISPATCHER_PASSWORD ?? 'Passw0rd!',
    name: 'Dana Dispatcher',
  },
} as const;
