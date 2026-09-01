import type { ApiHealth, FullReport, ReconcileRequest } from "../types";

const REQUEST_TIMEOUT_MS = 65_000;

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requestJson<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const body = (await response.json().catch(() => null)) as
      | T
      | { error?: string }
      | null;
    if (!response.ok) {
      const message =
        body && typeof body === "object" && "error" in body && body.error
          ? body.error
          : `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        "The request timed out. Render may be waking from its free-tier sleep; try again.",
      );
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : "Unable to reach SettleSure",
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export function health(): Promise<ApiHealth> {
  return requestJson<ApiHealth>("/api/health");
}

export function reconcile(
  payload: ReconcileRequest,
  idempotencyKey = crypto.randomUUID(),
): Promise<FullReport> {
  return requestJson<FullReport>("/api/v1/reconcile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}
