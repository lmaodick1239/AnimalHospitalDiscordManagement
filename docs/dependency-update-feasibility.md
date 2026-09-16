# Dependency Update Feasibility Investigation

## 1. Overview & Deprecation Analysis

During `npm install`, four deprecation warnings were emitted:
1. `npm warn deprecated inflight@1.0.6`: Memory leak, unmaintained.
2. `npm warn deprecated glob@7.2.3`: Unmaintained legacy version.
3. `npm warn deprecated prebuild-install@7.1.3`: No longer maintained.
4. `npm warn deprecated caxa@3.0.1`: Package no longer supported.

### Dependency Origin Tracing (`npm ls`)

```text
animal-hospital-organizer@0.1.0
├── better-sqlite3@11.10.0
│   └── prebuild-install@7.1.3
└── caxa@3.0.1
    └── archiver@5.3.2
        ├── archiver-utils@2.1.0
        │   └── glob@7.2.3
        │       └── inflight@1.0.6
        └── zip-stream@4.1.1
            └── archiver-utils@3.0.4
                └── glob@7.2.3 deduped
```

**Key Finding**:
* `inflight@1.0.6` and `glob@7.2.3` are **not direct dependencies**; they are transitive dependencies exclusively pulled in by `caxa@3.0.1` via `archiver@5.3.2`.
* `prebuild-install@7.1.3` is **not a direct dependency**; it is pulled in exclusively by `better-sqlite3@11.10.0`.
* `caxa@3.0.1` and `better-sqlite3` are the only root causes of all four deprecation notices.

---

## 2. Investigation of Root Causes

### A. `better-sqlite3` (current: `^11.6.0` / resolved `11.10.0`)
* **Upstream Status**:
  * In `better-sqlite3@11.x` and `12.x`, native binary downloads relied on `prebuild-install`.
  * `better-sqlite3@13.0.0+` dropped `prebuild-install` and `bindings` in favor of `node-addon-api@^8.0.0` with prebuilt tarballs downloaded directly from GitHub releases via an internal script.
* **Compatibility & Feasibility**:
  * `better-sqlite3@13.0.x` requires Node engine `>=22`. The current runtime environment is Node `v24.17.0`, but [package.json](package.json) specifies `"engines": { "node": ">=20" }`.
  * TypeScript type definitions: `@types/better-sqlite3` has major version `9.6.0` (matching newer better-sqlite3 releases).
  * `better-sqlite3` major version bumps (11 -> 12 -> 13) carry potential ABI and behavior changes with bundled SQLite versions.
* **Risk Level**: Medium.
  * For development with Node 22+, upgrading to v13 removes `prebuild-install`.
  * If compatibility with Node 20 LTS must be retained in production, `better-sqlite3` v11 or v12 is required, keeping `prebuild-install` in place. Note that `prebuild-install` produces warnings during install but functions without runtime disruption.

### B. `caxa@3.0.1` (devDependency)
* **Upstream Status**:
  * `caxa` was created by `leafac` and last published in October 2022. The repository was archived/deprecated, with npm marking it "Package no longer supported".
  * It pulls in old `archiver` versions, which in turn pull in `glob@7` and `inflight@1`.
* **Current Workspace Usage**:
  * Used solely in packaging scripts:
    * `npm run package`
    * `npm run package:win`
    * [build.sh](build.sh#L11-L14)
    * [build.bat](build.bat#L23)
  * It is NOT used at runtime in production or development (`npm start`, `npm test` do not touch `caxa`).
* **Replacement Options**:
  1. **Node.js Single Executable Applications (SEA)** (Native Node.js feature since v20):
     * Native Node.js built-in mechanism for generating standalone binaries (`node --experimental-sea-config`).
     * Eliminates external packaging dependencies entirely.
     * Note: Better-sqlite3 is a native C++ addon (`.node`); Node SEA requires handling native addons either via unpacked assets or bundling.
  2. **Keep `caxa` for now**:
     * Because `caxa` is strictly a build-time devDependency, it does not affect production runtime stability or introduce server memory leaks. `npm audit` currently reports **0 vulnerabilities**.

---

## 3. Other Dependencies Status (`npm outdated`)

| Package | Current | Latest | Feasibility / Notes |
|---|---|---|---|
| `express` | `4.22.3` | `5.2.1` | **Major upgrade (v4 -> v5)**. Express 5 introduces changes to router regex matching, query parsing, and error handling. Upgrading requires a dedicated migration and regression testing of all web endpoints. |
| `ulid` | `2.4.0` | `3.0.2` | Minor/major changes. Current v2 is completely stable. |
| `typescript` | `5.9.3` | `7.0.2` | TypeScript 7 / major bump. Check project tsconfig compatibility. |
| `@types/node` | `22.20.2` | `22.20.3` | Patch update. Safe to update immediately. |

---

## 4. Recommended Action Plan

1. **Immediate / Low Risk**:
   * No immediate emergency fixes are required for production operations. `npm audit` reports **0 vulnerabilities**, and existing tests pass (62/62).
   * Update patch dependencies (e.g. `@types/node`).

2. **Medium Term (Resolving `better-sqlite3` & `prebuild-install`)**:
   * If the deployment target environment runs Node `>=22`: test upgrading `better-sqlite3` to `^13.0.3` and `@types/better-sqlite3` to `^9.6.0`, updating `package.json` engines to `>=22`.
   * If Node 20 support must be preserved: retain `better-sqlite3@11.x` / `12.x`.

3. **Longer Term (Resolving `caxa`, `glob`, `inflight`)**:
   * Transition executable builds in [build.sh](build.sh) and [build.bat](build.bat) from `caxa` to Node.js native SEA (Single Executable Applications) or modern bundling workflows, allowing `caxa` and its transitive chain (`archiver` -> `glob@7` -> `inflight`) to be completely removed from `devDependencies`.
