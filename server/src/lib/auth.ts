import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/client.js';

const BCRYPT_COST = 10;

export interface JwtPayload {
  sub: string; // user id
  username: string;
  roles: string[];
  perms: string[];
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtTtlSeconds });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

export interface UserWithPerms {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: number;
  failed_login_count: number;
  locked_until: string | null;
  last_login_at: string | null;
  roles: string[];
  permissions: string[];
}

export function loadUser(userId: string): UserWithPerms | null {
  const row = db()
    .prepare(
      `SELECT id, username, full_name, email, phone, is_active,
              failed_login_count, locked_until, last_login_at
         FROM users WHERE id = ?`,
    )
    .get(userId) as Omit<UserWithPerms, 'roles' | 'permissions'> | undefined;
  if (!row) return null;

  const roles = db()
    .prepare(
      `SELECT r.name FROM roles r
         INNER JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = ?`,
    )
    .all(userId) as { name: string }[];

  const perms = db()
    .prepare(
      `SELECT DISTINCT p.key FROM permissions p
         INNER JOIN role_permissions rp ON rp.permission_id = p.id
         INNER JOIN user_roles ur ON ur.role_id = rp.role_id
         WHERE ur.user_id = ?`,
    )
    .all(userId) as { key: string }[];

  return {
    ...row,
    roles: roles.map((r) => r.name),
    permissions: perms.map((p) => p.key),
  };
}