import fs from "node:fs";
import path from "node:path";

/**
 * Loads .env into process.env if present and supported.
 * Keeps external dependencies out of the project as per plan specs.
 */
export function loadEnv(envPath: string = path.resolve(process.cwd(), ".env")): void {
  const loadFn = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  if (typeof loadFn === "function") {
    if (fs.existsSync(envPath)) {
      try {
        loadFn(envPath);
      } catch {
        // Ignore errors reading or parsing
      }
    }
  }
}
