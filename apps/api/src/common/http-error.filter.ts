import {
  ArgumentsHost,
  Catch,
  HttpException,
  type ExceptionFilter,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const statusCode = exception.getStatus();
    const detail = exception.getResponse();
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
