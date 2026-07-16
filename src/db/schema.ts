export * from './schema/core';
export * from './schema/discovery';
export * from './schema/research';
export * from './schema/audits';
export * from './schema/outreach';
export * from './schema/strategy';
export * from './schema/jobs';

// `leads` is a backward-compatible alias for the `prospects` table.
// New code should use `prospects` directly; `leads` exists for legacy query paths.
export { prospects as leads } from './schema/core';

