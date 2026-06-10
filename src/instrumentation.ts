export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { setupLocalDatabaseMock } = await import('./db/local-mock');
    setupLocalDatabaseMock();
  }
}
