import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ObjStringToSnakeCase } from '../utils/string.util';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const status = ctx.switchToHttp().getResponse().statusCode;

    return next.handle().pipe(
      map((data) => {
        const { message, metadata, ...rest } = data ?? {};

        return {
          status_code: status,
          message: message ?? 'Success!',
          data: Object.keys(rest).length > 0 ? ObjStringToSnakeCase(rest) : null,
          ...(metadata && { metadata: ObjStringToSnakeCase(metadata) }),
        };
      }),
    );
  }
}
