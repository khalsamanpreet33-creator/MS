import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { hashPassword, verifyPassword, signJwt, loadUser } from '../lib/auth.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

router.post('/login', (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = db()
      .prepare(
        `SELECT id, username, password_hash, is_active, failed_login_count, locked_until
           FROM users WHERE username = ?`,
      )
      .get(body.username) as
      | {
          id: string;
          username: string;
          password_hash: string;
          is_active: number;
          failed_login_count: number;
          locked_until: string | null;
        }
      | undefined;

    if (!user || !verifyPassword(body.password, user.password_hash)) {
      if (user) {
        const newCount = user.failed_login_count + 1;
        const lockUntil =
          newCount >= LOCKOUT_THRESHOLD
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
            : user.locked_until;
        db()
          .prepare(
            'UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = datetime(\'now\') WHERE id = ?',
          )
          .run(newCount, lockUntil, user.id);
      }
      throw new HttpError(401, 'invalid_credentials');
    }

    if (!user.is_active) throw new HttpError(403, 'account_disabled');
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new HttpError(423, 'account_locked', { until: user.locked_until });
    }

    const profile = loadUser(user.id)!;
    const token = signJwt({
      sub: profile.id,
      username: profile.username,
      roles: profile.roles,
      perms: profile.permissions,
    });

    db()
      .prepare(
        'UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = datetime(\'now\') WHERE id = ?',
      )
      .run(user.id);

    res.json({
      token,
      user: {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        roles: profile.roles,
        permissions: profile.permissions,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req, res) => {
  const u = req.user!;
  res.json({
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone,
    roles: u.roles,
    permissions: u.permissions,
    last_login_at: u.last_login_at,
  });
});

router.post('/logout', requireAuth, (_req, res) => {
  // Stateless JWT; client drops the token. Logged for audit only.
  res.json({ ok: true });
});

const createUserSchema = z.object({
  username: z.string().min(3).max(80),
  password: z.string().min(4).max(200),
  full_name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  roles: z.array(z.string()).min(1),
});

router.post('/users', requireAuth, requirePerm('system.admin'), (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);
    const existing = db()
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(body.username);
    if (existing) throw new HttpError(409, 'username_taken');

    const userId = id('usr');
    const insert = db().transaction(() => {
      db()
        .prepare(
          `INSERT INTO users (id, username, full_name, email, phone, password_hash)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          body.username,
          body.full_name,
          body.email || null,
          body.phone || null,
          hashPassword(body.password),
        );
      for (const roleName of body.roles) {
        const role = db().prepare('SELECT id FROM roles WHERE name = ?').get(roleName) as
          | { id: string }
          | undefined;
        if (!role) throw new HttpError(400, 'invalid_role', { role: roleName });
        db()
          .prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)')
          .run(userId, role.id);
      }
    });
    insert();

    const created = loadUser(userId)!;
    res.status(201).json({
      id: created.id,
      username: created.username,
      full_name: created.full_name,
      email: created.email,
      phone: created.phone,
      roles: created.roles,
      permissions: created.permissions,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/users', requireAuth, requirePerm('students.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active,
              u.last_login_at,
              GROUP_CONCAT(r.name) AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         GROUP BY u.id
         ORDER BY u.created_at DESC`,
    )
    .all() as { roles: string | null }[];
  res.json(
    rows.map((r) => ({
      ...r,
      roles: r.roles ? r.roles.split(',') : [],
    })),
  );
});

export default router;