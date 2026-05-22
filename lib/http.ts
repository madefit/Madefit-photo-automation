export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown
  ) {
    super(message);
  }
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  const body = text ? safeJson(text) : null;

  if (!response.ok) {
    throw new HttpError(`HTTP ${response.status}`, response.status, body);
  }

  return body as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number; retryableStatus?: number[] } = {}
) {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 350;
  const retryableStatus = options.retryableStatus ?? [408, 425, 429, 500, 502, 503, 504];
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error instanceof HttpError ? error.status : 0;
      if (attempt === attempts || (status && !retryableStatus.includes(status))) break;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
    }
  }

  throw lastError;
}
