import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL environment variable is not set, using fallback for development");
  process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/slab_dev";
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
