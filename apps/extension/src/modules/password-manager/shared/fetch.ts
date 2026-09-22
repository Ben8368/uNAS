const REQUEST_TIMEOUT_MS = 12_000;

/** Keep the deadline active until the consumer finishes reading the response body. */
export async function fetchWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  consume: (response: Response) => Promise<T>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal });
    return await consume(response);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("网络请求超时，请稍后重试", { cause: error });
    if (init.signal?.aborted) throw error;
    throw new Error("网络请求失败，请稍后重试", { cause: error });
  } finally {
    clearTimeout(timeout);
    // Also releases unread response bodies on HTTP errors and header-only calls.
    controller.abort();
  }
}

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<{ response: Response; body: T | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const body = await response.json().catch((error: unknown) => {
      if (controller.signal.aborted) throw error;
      return null;
    }) as T | null;
    return { response, body };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("网络请求超时，请稍后重试", { cause: error });
    throw new Error("网络请求失败，请稍后重试", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
