import { ContentError } from '@sacute/shared/content';
import {
  ArgumentsHost,
  Catch,
  HttpException,
  type ExceptionFilter,
} from '@nestjs/common';

@Catch(HttpException, ContentError)
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: HttpException | ContentError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const statusCode =
      exception instanceof ContentError
        ? exception.status
        : exception.getStatus();
    const detail =
      exception instanceof ContentError
        ? exception.message
        : exception.getResponse();
    response.status(statusCode).json({
      error: {
        statusCode,
        message:
          typeof detail === 'string'
            ? detail
            : ((detail as { message?: unknown }).message ?? exception.message),
      },
    });
  }
}
