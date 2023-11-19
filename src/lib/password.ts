import { hash, verify } from "argon2";

export function encryptPassword(password: string): Promise<string> {
  return hash(password);
}

export function comparePassword(
  password: string,
  hashed: string,
): Promise<boolean> {
  return verify(hashed, password).catch(() => false);
}
