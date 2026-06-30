import { test } from 'node:test';
import assert from 'node:assert';
import { users, leads, tasks, notes, activities, contacts, jobRuns, researchSnapshots } from '../schema.js';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

test('schema definition', async (t) => {
  await t.test('users table should be defined', () => {
    const config = getTableConfig(users);
    assert.strictEqual(config.name, 'users');
  });

  await t.test('leads table should be defined (renamed to prospects)', () => {
    const config = getTableConfig(leads);
    assert.strictEqual(config.name, 'prospects');
  });

  await t.test('tasks table should be defined', () => {
    const config = getTableConfig(tasks);
    assert.strictEqual(config.name, 'tasks');
  });

  await t.test('notes table should be defined', () => {
    const config = getTableConfig(notes);
    assert.strictEqual(config.name, 'notes');
  });

  await t.test('activities table should be defined', () => {
    const config = getTableConfig(activities);
    assert.strictEqual(config.name, 'activities');
  });

  await t.test('contacts table should be defined', () => {
    const config = getTableConfig(contacts);
    assert.strictEqual(config.name, 'contacts');
  });

  await t.test('jobRuns table should be defined', () => {
    const config = getTableConfig(jobRuns);
    assert.strictEqual(config.name, 'job_runs');
  });

  await t.test('researchSnapshots table should be defined', () => {
    const config = getTableConfig(researchSnapshots);
    assert.strictEqual(config.name, 'research_snapshots');
  });
});
