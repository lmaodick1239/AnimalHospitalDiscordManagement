import fs from "node:fs";
import path from "node:path";

export function findEnvPath(
  explicitPath?: string,
  searchDirs: string[] = [process.cwd(), path.dirname(process.execPath)]
): string | undefined {
  if (explicitPath) {
    return fs.existsSync(explicitPath) ? explicitPath : undefined;
  }
  for (const dir of searchDirs) {
    const candidate = path.resolve(dir, ".env");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Loads .env into process.env if present and supported.
 * Checks explicit path, current working directory, and executable directory.
 */
export function loadEnv(envPath?: string): void {
  const resolvedPath = findEnvPath(envPath);
  if (!resolvedPath) return;

  const loadFn = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  if (typeof loadFn === "function") {
    try {
      loadFn(resolvedPath);
    } catch {
      // Ignore errors reading or parsing
    }
  }
}
