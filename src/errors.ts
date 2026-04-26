export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(400, "validation_error", message, details);
  }
}

export class UpstreamError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(502, "upstream_error", message, details);
  }
}
