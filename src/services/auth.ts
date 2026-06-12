import { Db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { encrypt } from '../lib/auth';

export class AuthService {
  constructor(private db: Db) {}

  async createUser(name: string, email: string, password: string) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const hashedPassword = `${salt}:${hash}`;
    const id = crypto.randomUUID();
    
    await this.db.insert(users).values({
      id,
      name,
      email,
      password: hashedPassword,
    });
    
    return { id, name, email };
  }

  async login(email: string, password: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      return null;
    }

    let passwordMatch = false;
    try {
      if (user.password.includes(':')) {
        const [salt, key] = user.password.split(':');
        const hashBuffer = crypto.scryptSync(password, salt, 64);
        const keyBuffer = Buffer.from(key, 'hex');
        if (hashBuffer.length === keyBuffer.length) {
          passwordMatch = crypto.timingSafeEqual(hashBuffer, keyBuffer);
        }
      } else {
        // Since we removed bcrypt, fail login for old bcrypt passwords.
        passwordMatch = false;
      }
    } catch (err) {
      passwordMatch = false;
    }
    
    if (!passwordMatch) {
      return null;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await encrypt({ userId: user.id, expiresAt });
    
    return {
      session,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }
}
