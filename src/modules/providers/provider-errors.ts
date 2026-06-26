export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(provider: string, message = 'Authentication failed') {
    super(message, provider, false);
    this.name = 'ProviderAuthError';
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(provider: string, message = 'Rate limit exceeded') {
    super(message, provider, true);
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderNotFoundError extends ProviderError {
  constructor(provider: string, message = 'File not found') {
    super(message, provider, false);
    this.name = 'ProviderNotFoundError';
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(provider: string, message = 'Provider unavailable') {
    super(message, provider, true);
    this.name = 'ProviderUnavailableError';
  }
}

interface HttpErrorLike {
  response?: { status?: number };
  message?: string;
}

export function getHttpErrorInfo(err: unknown): {
  status?: number;
  message?: string;
} {
  if (err instanceof Error) {
    const httpErr = err as unknown as HttpErrorLike;
    return {
      status: httpErr.response?.status,
      message: err.message,
    };
  }
  const httpErr = err as HttpErrorLike;
  return {
    status: httpErr?.response?.status,
    message: httpErr?.message,
  };
}
