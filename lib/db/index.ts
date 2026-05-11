import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

type DB = NeonHttpDatabase<typeof schema> & { $client: ReturnType<typeof neon> }

export function getDb(): DB {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return drizzle(neon(url), { schema }) as DB
}

// Lazy singleton — instantiated on first property access at runtime, not at module load
let _instance: DB | undefined
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: DB = new Proxy({} as DB, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(_, prop: string | symbol): any {
    if (!_instance) _instance = getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_instance as any)[prop]
  },
})
