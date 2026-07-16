import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import kvTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";

// TODO: Add queue handler config — e.g.:
//   import queueHandler from "@opennextjs/cloudflare/overrides/queue";
// and wire it into the config object below.

// TODO: Add middleware handler config for Workers deploy — e.g.:
//   import { withMiddleware } from "@opennextjs/cloudflare/overrides/middleware";
//   middleware: withMiddleware,

export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: kvTagCache,
});
