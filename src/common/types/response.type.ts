export type TResponse<T extends object = object> = T & {
  message?: string;
  metadata?: Record<string, unknown>;
};
