import handler from '../.open-next/worker.js';
import { ResearchSnapshotWorkflow } from './workflows/research-snapshot';
import { DiscoverySearchWorkflow } from './workflows/discovery-search';

export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (typeof handler.fetch === 'function') {
      return handler.fetch(request, env, ctx);
    }
    return (handler as any)(request, env, ctx);
  }
};

export { ResearchSnapshotWorkflow, DiscoverySearchWorkflow };
