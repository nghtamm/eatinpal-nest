import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const res = exception.getResponse();

    let message = 'Internal Server Error';
    let errors: string[] = [];

    if (typeof res === 'string') {
      message = res;
    } else if (typeof res === 'object') {
      const body = res as Record<string, any>;

      if (Array.isArray(body.message)) {
        errors = body.message;
        message = body.error ?? 'Bad Request';
      } else {
        message = body.message ?? body.error ?? message;
      }
    }

    response.status(status).json({
      status_code: status,
      message,
      ...(errors.length > 0 && { errors }),
    });
  }
}
