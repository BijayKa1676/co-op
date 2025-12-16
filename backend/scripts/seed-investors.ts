/**
 * Seed script for populating the investors database
 * Run with: npx ts-node -r tsconfig-paths/register scripts/seed-investors.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { investors } from '../src/database/schema/investors.schema';

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

interface InvestorSeed {
  name: string;
  description: string;
  website: string;
  stage: 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'series-c' | 'growth';
  sectors: string; // comma-separated
  checkSizeMin: number;
  checkSizeMax: number;
  location: string;
  regions: string; // comma-separated
  linkedinUrl?: string;
  twitterUrl?: string;
  isFeatured: boolean;
}

const investorData: InvestorSeed[] = [
  {
    name: 'Y Combinator',
    description: 'The most prestigious startup accelerator. Invests $500K in startups twice a year.',
    website: 'https://www.ycombinator.com',
    stage: 'pre-seed',
    sectors: 'saas,fintech,ai,consumer,enterprise,healthtech',
    checkSizeMin: 125,
    checkSizeMax: 500,
    location: 'San Francisco, CA',
    regions: 'us,global',
    linkedinUrl: 'https://linkedin.com/company/y-combinator',
    twitterUrl: 'https://twitter.com/ycombinator',
    isFeatured: true,
  },
  {
    name: 'Sequoia Capital',
    description: 'Legendary VC firm backing companies worth over $3.3 trillion in combined market value.',
    website: 'https://www.sequoiacap.com',
    stage: 'series-a',
    sectors: 'saas,fintech,ai,consumer,enterprise,crypto,healthtech',
    checkSizeMin: 1000,
    checkSizeMax: 25000,
    location: 'Menlo Park, CA',
    regions: 'us,eu,apac,global',
    linkedinUrl: 'https://linkedin.com/company/sequoia-capital',
    twitterUrl: 'https://twitter.com/sequoia',
    isFeatured: true,
  },
  {
    name: 'Andreessen Horowitz',
    description: 'Software-focused VC firm with $35B+ under management.',
    website: 'https://a16z.com',
    stage: 'series-a',
    sectors: 'saas,fintech,ai,crypto,consumer,enterprise',
    checkSizeMin: 2000,
    checkSizeMax: 50000,
    location: 'Menlo Park, CA',
    regions: 'us,global',
    linkedinUrl: 'https://linkedin.com/company/andreessen-horowitz',
    twitterUrl: 'https://twitter.com/a16z',
    isFeatured: true,
  },
  {
    name: 'First Round Capital',
    description: 'Seed-stage VC focused on building a community of entrepreneurs.',
    website: 'https://firstround.com',
    stage: 'seed',
    sectors: 'saas,enterprise,consumer,fintech',
    checkSizeMin: 500,
    checkSizeMax: 3000,
    location: 'San Francisco, CA',
    regions: 'us',
    linkedinUrl: 'https://linkedin.com/company/first-round-capital',
    isFeatured: true,
  },
  {
    name: 'Accel',
    description: 'Global VC firm with over 50 years of experience backing entrepreneurs.',
    website: 'https://www.accel.com',
    stage: 'series-a',
    sectors: 'saas,fintech,consumer,enterprise,ai',
    checkSizeMin: 1000,
    checkSizeMax: 20000,
    location: 'Palo Alto, CA',
    regions: 'us,eu,apac',
    linkedinUrl: 'https://linkedin.com/company/accel-partners',
    isFeatured: true,
  },
  {
    name: 'Ribbit Capital',
    description: 'Fintech-focused VC with deep expertise in financial services.',
    website: 'https://ribbitcap.com',
    stage: 'seed',
    sectors: 'fintech,crypto',
    checkSizeMin: 500,
    checkSizeMax: 15000,
    location: 'Palo Alto, CA',
    regions: 'us,global',
    isFeatured: true,
  },
  {
    name: 'Balderton Capital',
    description: 'Leading European VC focused on Series A and B.',
    website: 'https://www.balderton.com',
    stage: 'series-a',
    sectors: 'saas,fintech,consumer,enterprise,healthtech',
    checkSizeMin: 1000,
    checkSizeMax: 20000,
    location: 'London, UK',
    regions: 'eu',
    linkedinUrl: 'https://linkedin.com/company/balderton-capital',
    isFeatured: false,
  },
  {
    name: 'Tiger Global',
    description: 'Crossover fund known for aggressive growth-stage investments.',
    website: 'https://www.tigerglobal.com',
    stage: 'growth',
    sectors: 'saas,fintech,consumer,enterprise,ai,crypto',
    checkSizeMin: 10000,
    checkSizeMax: 500000,
    location: 'New York, NY',
    regions: 'us,global',
    isFeatured: false,
  },
  {
    name: 'General Catalyst',
    description: 'Growth-stage VC with $25B+ under management.',
    website: 'https://www.generalcatalyst.com',
    stage: 'series-b',
    sectors: 'saas,fintech,healthtech,consumer,enterprise,ai',
    checkSizeMin: 5000,
    checkSizeMax: 100000,
    location: 'Cambridge, MA',
    regions: 'us,eu',
    linkedinUrl: 'https://linkedin.com/company/general-catalyst-partners',
    isFeatured: false,
  },
  {
    name: 'Techstars',
    description: 'Global accelerator network with programs in 150+ countries.',
    website: 'https://www.techstars.com',
    stage: 'pre-seed',
    sectors: 'saas,fintech,healthtech,ai,climate',
    checkSizeMin: 20,
    checkSizeMax: 120,
    location: 'Boulder, CO',
    regions: 'us,eu,global',
    linkedinUrl: 'https://linkedin.com/company/techstars',
    isFeatured: false,
  },
];

async function seed() {
  console.log('🌱 Seeding investors database...');

  try {
    let added = 0;
    let skipped = 0;

    for (const inv of investorData) {
      const existing = await db
        .select({ id: investors.id })
        .from(investors)
        .where(eq(investors.name, inv.name))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  ⏭ Skipped ${inv.name} (already exists)`);
        skipped++;
        continue;
      }

      await db.insert(investors).values({
        name: inv.name,
        description: inv.description,
        website: inv.website,
        stage: inv.stage,
        sectors: inv.sectors,
        checkSizeMin: inv.checkSizeMin,
        checkSizeMax: inv.checkSizeMax,
        location: inv.location,
        regions: inv.regions,
        linkedinUrl: inv.linkedinUrl,
        twitterUrl: inv.twitterUrl,
        isActive: true,
        isFeatured: inv.isFeatured,
      });

      console.log(`  ✓ Added ${inv.name}`);
      added++;
    }

    console.log(`\n✅ Seed complete: ${added} added, ${skipped} skipped`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

seed();
