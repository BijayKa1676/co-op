import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { pgTable, uuid, varchar, boolean, timestamp, text } from 'drizzle-orm/pg-core';

dotenv.config();

const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  supabaseId: varchar('supabase_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  authProvider: varchar('auth_provider', { length: 50 }),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

const startups = pgTable('startups', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  founderName: varchar('founder_name', { length: 255 }).notNull(),
  founderRole: varchar('founder_role', { length: 100 }).notNull(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  tagline: varchar('tagline', { length: 500 }),
  description: text('description').notNull(),
  website: varchar('website', { length: 500 }),
  industry: varchar('industry', { length: 100 }).notNull(),
  sector: varchar('sector', { length: 50 }).notNull(),
  businessModel: varchar('business_model', { length: 100 }).notNull(),
  stage: varchar('stage', { length: 50 }).notNull(),
  foundedYear: varchar('founded_year', { length: 4 }).notNull(),
  teamSize: varchar('team_size', { length: 20 }).notNull(),
  cofounderCount: varchar('cofounder_count', { length: 10 }).notNull(),
  country: varchar('country', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }),
  fundingStage: varchar('funding_stage', { length: 50 }),
  isRevenue: varchar('is_revenue', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@co-op.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!@#';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Co-Op Admin';

async function seedAdmin() {
  process.stdout.write('Starting admin seed...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  process.stdout.write('SUPABASE_URL: ' + (supabaseUrl ? 'SET' : 'MISSING') + '\n');
  process.stdout.write('SUPABASE_SERVICE_KEY: ' + (supabaseServiceKey ? 'SET' : 'MISSING') + '\n');
  process.stdout.write('DATABASE_URL: ' + (databaseUrl ? 'SET' : 'MISSING') + '\n');

  if (!supabaseUrl || !supabaseServiceKey || !databaseUrl) {
    process.stderr.write('Missing env vars!\n');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);

  try {
    console.log('Checking for admin: ' + ADMIN_EMAIL);
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingAdmin = existingUsers?.users?.find(u => u.email === ADMIN_EMAIL);

    let supabaseUserId: string;

    if (existingAdmin) {
      console.log('Admin exists in Supabase');
      supabaseUserId = existingAdmin.id;
      await supabase.auth.admin.updateUserById(supabaseUserId, {
        app_metadata: { role: 'admin' },
        user_metadata: { full_name: ADMIN_NAME },
      });
    } else {
      console.log('Creating admin in Supabase...');
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        app_metadata: { role: 'admin' },
        user_metadata: { full_name: ADMIN_NAME },
      });
      if (error || !newUser.user) throw new Error('Failed: ' + error?.message);
      supabaseUserId = newUser.user.id;
      console.log('Admin created in Supabase');
    }

    console.log('Syncing to database...');
    const existingDbUser = await db.select().from(users).where(eq(users.supabaseId, supabaseUserId)).limit(1);

    let dbUserId: string;
    if (existingDbUser.length > 0) {
      dbUserId = existingDbUser[0].id;
      await db.update(users).set({ role: 'admin', name: ADMIN_NAME }).where(eq(users.id, dbUserId));
      console.log('Admin updated in database');
    } else {
      const [newDbUser] = await db.insert(users).values({
        supabaseId: supabaseUserId,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        role: 'admin',
        authProvider: 'email',
        onboardingCompleted: true,
      }).returning();
      dbUserId = newDbUser.id;
      console.log('Admin created in database');
    }

    const existingStartup = await db.select().from(startups).where(eq(startups.userId, dbUserId)).limit(1);
    if (existingStartup.length === 0) {
      console.log('Creating startup profile...');
      await db.insert(startups).values({
        userId: dbUserId,
        founderName: ADMIN_NAME,
        founderRole: 'ceo',
        companyName: 'Co-Op Platform',
        tagline: 'AI Advisory for Startups',
        description: 'AI-powered advisory platform.',
        website: 'https://co-op.dev',
        industry: 'ai_ml',
        sector: 'saas',
        businessModel: 'b2b',
        stage: 'growth',
        foundedYear: '2024',
        teamSize: '6-20',
        cofounderCount: '2',
        country: 'United States',
        city: 'San Francisco',
        fundingStage: 'seed',
        isRevenue: 'yes',
      });
      console.log('Startup created');
    }

    console.log('\nDone! Email: ' + ADMIN_EMAIL + ' Password: ' + ADMIN_PASSWORD);
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdmin();
