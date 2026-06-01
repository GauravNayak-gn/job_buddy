/**
 * Extracts a human-readable message from an HTTP error response.
 * Replaces the private errorMessage() method duplicated across
 * login, profile, post-job, and matches components.
 */
export function extractErrorMessage(error: { error?: unknown; message?: string }): string {
  if (typeof error.error === 'string') {
    return error.error;
  }
  if (error.error && typeof error.error === 'object') {
    if ('detail' in error.error) {
      return (error.error as { detail: string }).detail;
    }
    return JSON.stringify(error.error);
  }
  return error.message ?? 'Request failed';
}
