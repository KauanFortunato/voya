import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const keyLength = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer

  return `scrypt:${salt.toString('hex')}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = encoded.split(':')
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false

  const storedHash = Buffer.from(hashHex, 'hex')
  const derivedKey = (await scrypt(password, Buffer.from(saltHex, 'hex'), storedHash.length)) as Buffer

  return storedHash.length === derivedKey.length && timingSafeEqual(storedHash, derivedKey)
}
