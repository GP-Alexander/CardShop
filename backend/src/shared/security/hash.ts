import argon2 from "argon2";

/**
 * Genera un hash seguro utilizando Argon2id (recomendado por OWASP).
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Valida una contraseña plana contra su hash Argon2id.
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    return false;
  }
}
