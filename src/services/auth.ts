import { type Db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { encrypt, hashPassword, verifyPassword } from '../lib/auth';

export class AuthService {
  constructor(private db: Db) {}

  async createUser(name: string, email: string, password: string) {
    const hashedPassword = await hashPassword(password);
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

    const passwordMatch = await verifyPassword(password, user.password);
    
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

