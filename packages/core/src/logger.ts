/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * `@fonoster/logger` ships a CJS module whose own default export is a
 * property literally named "default" on `module.exports`. Node's native
 * ESM/CJS interop reserves that name for the synthetic default (which always
 * equals the whole `module.exports`), so a plain `import logger from
 * "@fonoster/logger"` silently binds to the wrong object at runtime — it has
 * `.default`, `.getLogger`, `.mute`, ... but no `.verbose`/`.info`/etc.
 * `createRequire` sidesteps Node's ESM interop and loads the module as real
 * CommonJS, where `.default` correctly resolves to the underlying
 * `winston.Logger` instance.
 */
import { createRequire } from "node:module";
import type { Logger } from "winston";

const require = createRequire(import.meta.url);
const fonosterLogger: { default: Logger } = require("@fonoster/logger");

export const logger: Logger = fonosterLogger.default;
