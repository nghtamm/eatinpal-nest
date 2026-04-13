export function CamelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function ObjStringToSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => ObjStringToSnakeCase(item));
  }

  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.entries(obj).reduce(
      (callback, [key, value]) => {
        callback[CamelToSnake(key)] = ObjStringToSnakeCase(value);
        return callback;
      },
      {} as Record<string, unknown>,
    );
  }

  return obj;
}
