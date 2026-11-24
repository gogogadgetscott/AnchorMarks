type MetadataResult = {
  title?: string;
  description?: string;
  og_image?: string;
};

const inFlight = new Map<string, Promise<MetadataResult>>();
const negativeCache = new Map<string, number>();
const successCache = new Map<string, MetadataResult>();
const NEGATIVE_TTL_MS = 10 * 60 * 1000;
const SUCCESS_TTL_MS = 60 * 60 * 1000;
const MAX_CONCURRENT = 2;
let active = 0;
const queue: Array<() => void> = [];

function isSkippable(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return true;
    if (parsed.hostname === "localhost") return true;
    if (
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(
        parsed.hostname,
      )
    )
      return true;
  } catch {
    return true;
  }
  return false;
}

function runNext(): void {
  if (active >= MAX_CONCURRENT) return;
  const start = queue.shift();
  if (!start) return;
  active++;
  start();
}

export function enqueueMetadata(
  url: string,
  loader: () => Promise<MetadataResult>,
): Promise<MetadataResult> {
  if (isSkippable(url)) {
    return Promise.resolve({
      title: new URL(url).hostname,
      description: "",
      url,
    });
  }

  const cached = successCache.get(url);
  if (cached) return Promise.resolve(cached);
  const failedAt = negativeCache.get(url);
  if (failedAt && Date.now() - failedAt < NEGATIVE_TTL_MS) {
    return Promise.resolve({
      title: new URL(url).hostname,
      description: "",
      url,
    });
  }

  const existing = inFlight.get(url);
  if (existing) return existing;

  let complete: ((value: MetadataResult) => void) | undefined;
  const promise = new Promise<MetadataResult>((resolve) => {
    complete = resolve;
  });
  inFlight.set(url, promise);

  queue.push(async () => {
    try {
      const result = await loader();
      if (result.og_image || result.title) {
        successCache.set(url, result);
        setTimeout(() => successCache.delete(url), SUCCESS_TTL_MS);
      }
      complete?.(result);
    } catch {
      negativeCache.set(url, Date.now());
      setTimeout(() => negativeCache.delete(url), NEGATIVE_TTL_MS);
      complete?.({ title: new URL(url).hostname, description: "", url });
    } finally {
      active--;
      inFlight.delete(url);
      runNext();
    }
  });

  runNext();
  return promise;
}

export function clearMetadataQueueCaches(): void {
  successCache.clear();
  negativeCache.clear();
}
