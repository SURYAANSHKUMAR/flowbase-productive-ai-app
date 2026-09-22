import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@/db/schema';
import { configuredValue } from '@/lib/env';

const databaseUrl = configuredValue("DATABASE_URL");

const sql = neon(databaseUrl);
export const db = drizzle({ client: sql, schema });
export * from '@/db/schema';
