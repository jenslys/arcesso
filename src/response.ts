import { ValidationError } from './errors.js';
import type { StandardSchemaV1 } from './types.js';

/**
 * Enhanced Response class that wraps native Response with Standard Schema validation
 */
export class EnhancedResponse {
  private _response: Response;

  constructor(response: Response) {
    this._response = response;
  }

  /**
   * Parse JSON with optional Standard Schema validation
   */
  async json<T extends StandardSchemaV1>(
    schema?: T
  ): Promise<T extends StandardSchemaV1<any, infer Output> ? Output : any> {
    const data = await this._response.json();

    if (!schema) {
      return data as T extends StandardSchemaV1<any, infer Output>
        ? Output
        : any;
    }

    const result = await schema['~standard'].validate(data);

    if ('value' in result && result.value !== undefined && !result.issues) {
      return result.value as T extends StandardSchemaV1<any, infer Output>
        ? Output
        : any;
    }

    if ('issues' in result && result.issues) {
      throw new ValidationError(
        `Response validation failed: ${result.issues[0]?.message || 'Unknown validation error'}`,
        result.issues
      );
    }

    throw new ValidationError('Unknown validation error', []);
  }

  // Delegate all other Response properties and methods
  get status(): number {
    return this._response.status;
  }

  get statusText(): string {
    return this._response.statusText;
  }

  get headers(): Headers {
    return this._response.headers;
  }

  get ok(): boolean {
    return this._response.ok;
  }

  get body(): ReadableStream<Uint8Array> | null {
    return this._response.body;
  }

  get bodyUsed(): boolean {
    return this._response.bodyUsed;
  }

  get url(): string {
    return this._response.url;
  }

  get redirected(): boolean {
    return this._response.redirected;
  }

  get type(): string {
    return this._response.type;
  }

  async text(): Promise<string> {
    return this._response.text();
  }

  async blob(): Promise<Blob> {
    return this._response.blob() as unknown as Promise<Blob>;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this._response.arrayBuffer();
  }

  async formData(): Promise<FormData> {
    return this._response.formData() as Promise<FormData>;
  }

  clone(): EnhancedResponse {
    return new EnhancedResponse(this._response.clone() as Response);
  }

  /**
   * Create an EnhancedResponse from a native Response
   */
  static from(response: Response): EnhancedResponse {
    return new EnhancedResponse(response);
  }
}
