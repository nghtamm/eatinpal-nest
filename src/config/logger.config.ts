import type { Params } from 'nestjs-pino';

export default (): Params => {
  const dev = process.env.NODE_ENV === 'development';

  return {
    pinoHttp: {
      level: dev ? 'debug' : 'info',
      autoLogging: false,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'body.password',
          'body.refresh_token',
        ],
        censor: '[REDACTED]',
      },
      ...(dev && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
    },
  };
};
