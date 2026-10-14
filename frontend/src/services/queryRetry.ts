import axios from 'axios';

export class BackendUnavailableError extends Error {
  constructor() {
    super('RentEase is temporarily unavailable. Please try again shortly.');
    this.name = 'BackendUnavailableError';
  }
}

// A sleeping host can return an HTML gateway page before the API is ready.
// Only query reads use this policy; mutations are never automatically replayed.
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 8) return false;
  if (error instanceof BackendUnavailableError) return true;
  if (!axios.isAxiosError(error) || axios.isCancel(error)) return false;
  if (!error.response) return ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code || '');
  return [502, 503, 504].includes(error.response.status);
}

export const queryRetryDelay = (attempt: number) => Math.min(2000 * 2 ** attempt, 10000);
