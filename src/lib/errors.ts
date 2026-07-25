/**
 * Sanitizes and formats error messages before presenting them to the client.
 * Specifically prevents database schemas, column names, and constraint failures from leaking.
 */
export function getSafeErrorMessage(error: unknown, defaultMessage: string = 'An internal error occurred'): string {
  if (!error) return defaultMessage;

  const message = error instanceof Error ? error.message : String(error);

  // Common database drivers/ORM error indicators
  const dbIndicators = [
    'sqlite',
    'drizzle',
    'constraint',
    'foreign key',
    'unique constraint',
    'table',
    'column',
    'query',
    'select',
    'insert',
    'update',
    'delete',
    'null value',
    'database',
    'sql'
  ];

  const lowerMessage = message.toLowerCase();
  const isDbError = dbIndicators.some(indicator => lowerMessage.includes(indicator));

  if (isDbError) {
    // Provide a safe, human-readable message instead of raw SQL dump
    if (lowerMessage.includes('unique') || lowerMessage.includes('already exists')) {
      return 'This record already exists.';
    }
    if (lowerMessage.includes('foreign key') || lowerMessage.includes('references')) {
      return 'The operation references an invalid or missing record.';
    }
    return defaultMessage;
  }

  return message;
}
