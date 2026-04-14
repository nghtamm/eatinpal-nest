import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { catchError, Observable, tap, throwError } from 'rxjs';

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const type = ctx.getType();
    this.logger.setContext(type.toUpperCase());

    if (type === 'http') {
      const request = ctx.switchToHttp().getRequest();
      const { method, url, body, query, params, ip } = request;
      const controller = ctx.getClass().name;
      const handler = ctx.getHandler().name;
      const userID: number | undefined = request.user?.id;
      const requestID = request.id;
      const start = Date.now();

      // [LOG - REQUEST]
      this.logger.info(
        {
          requestID,
          type: 'REQUEST',
          method,
          url,
          controller,
          handler,
          userID,
          ip,
          params: Object.keys(params).length > 0 ? params : undefined,
          query: Object.keys(query).length > 0 ? query : undefined,
          body: body && Object.keys(body).length > 0 ? body : undefined,
        },
        `→ ${method} ${url} | ${controller}.${handler}`,
      );

      // [LOG - RESPONSE]
      return next.handle().pipe(
        tap(() => {
          const status = ctx.switchToHttp().getResponse().statusCode;
          const duration = Date.now() - start;

          this.logger.info(
            {
              requestID,
              type: 'RESPONSE',
              method,
              url,
              controller,
              handler,
              userID,
              status,
              duration: `${duration}ms`,
            },
            `← ${method} ${url} | ${controller}.${handler} | ${status} | ${duration}ms`,
          );
        }),
        catchError((err) => {
          const status = err?.getStatus?.() ?? 500;
          const duration = Date.now() - start;

          this.logger.error(
            {
              requestID,
              type: 'ERROR',
              method,
              url,
              controller,
              handler,
              userID,
              status,
              duration: `${duration}ms`,
              error: err.message,
              stack: err.stack,
            },
            `✗ ${method} ${url} | ${controller}.${handler} | ${status} ${err.message} | ${duration}ms`,
          );
          return throwError(() => err);
        }),
      );
    }

    return next.handle();
  }
}
