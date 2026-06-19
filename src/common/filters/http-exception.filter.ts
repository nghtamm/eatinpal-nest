import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { STATUS_CODES } from 'http';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const res = exception.getResponse();

    let message = STATUS_CODES[status] ?? 'Error';
    let errors: string[] = [];
    let errorCode: string | undefined;

    if (typeof res === 'string') {
      message = res;
    } else if (typeof res === 'object') {
      const body = res as Record<string, any>;
      errorCode = body.errorCode;

      if (Array.isArray(body.message)) {
        errors = body.message;
        message = body.error ?? message;
      } else {
        message = body.message ?? body.error ?? message;
      }
    }

    response.status(status).json({
      status_code: status,
      message,
      ...(errorCode && { error_code: errorCode }),
      ...(errors.length > 0 && { errors }),
    });
  }
}
