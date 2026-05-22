// Retry utility for API calls with exponential backoff
// 3 attempts, 1000ms delay between retries

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

export async function retryFetch(
  url: string,
  options?: RequestInit,
  attempt: number = 1
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    if (attempt < RETRY_ATTEMPTS) {
      console.error(`Fetch failed (attempt ${attempt}/${RETRY_ATTEMPTS}):`, error);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return retryFetch(url, options, attempt + 1);
    } else {
      console.error(`Fetch failed after ${RETRY_ATTEMPTS} attempts:`, error);
      throw error;
    }
  }
}

export async function retryAsync<T>(
  fn: () => Promise<T>,
  attempt: number = 1
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempt < RETRY_ATTEMPTS) {
      console.error(`Operation failed (attempt ${attempt}/${RETRY_ATTEMPTS}):`, error);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return retryAsync(fn, attempt + 1);
    } else {
      console.error(`Operation failed after ${RETRY_ATTEMPTS} attempts:`, error);
      throw error;
    }
  }
}
