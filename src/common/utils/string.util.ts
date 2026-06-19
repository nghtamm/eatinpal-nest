export function CamelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function ObjectKeysToSnake(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => ObjectKeysToSnake(item));
  }

  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.entries(obj).reduce(
      (callback, [key, value]) => {
        callback[CamelToSnake(key)] = ObjectKeysToSnake(value);
        return callback;
      },
      {} as Record<string, unknown>,
    );
  }

  return obj;
}

export function NormalizeText(str: string): string {
  return str.toLowerCase().trim();
}
