import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Check if response is already wrapped in ApiResponseDto format
 */
function isAlreadyWrapped(data: unknown): boolean {
  if (data === null || data === undefined) return false;
  if (typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  return typeof obj.success === 'boolean' && 'data' in obj;
}

/**
 * Transform all successful responses to a consistent format:
 * { success: true, data: <response> }
 * 
 * This ensures the frontend can always expect the same response structure.
 * Skips wrapping if the response is already in the correct format (from ApiResponseDto).
 */
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map(data => {
        // Don't double-wrap responses that are already in ApiResponseDto format
        if (isAlreadyWrapped(data)) {
          return data;
        }
        
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
