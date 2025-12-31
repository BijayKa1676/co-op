import { pgTable, uuid, varchar, text, bigint, decimal, date, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users.schema';
import { startups } from './startups.schema';

// ============================================
// CAP TABLE
// ============================================

export const capTables = pgTable(
  'cap_tables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    startupId: uuid('startup_id').references(() => startups.id, { onDelete: 'set null' }),

    name: varchar('name', { length: 255 }).notNull().default('Main Cap Table'),
    description: text('description'),

    // Company info
    companyName: varchar('company_name', { length: 255 }).notNull(),
    incorporationDate: date('incorporation_date'),
    authorizedShares: bigint('authorized_shares', { mode: 'number' }).notNull().default(10000000),

    // Current state
    totalIssuedShares: bigint('total_issued_shares', { mode: 'number' }).notNull().default(0),
    fullyDilutedShares: bigint('fully_diluted_shares', { mode: 'number' }).notNull().default(0),

    // Valuation
    currentValuation: decimal('current_valuation', { precision: 20, scale: 2 }),
    pricePerShare: decimal('price_per_share', { precision: 20, scale: 6 }),

    // Options pool
    optionsPoolSize: bigint('options_pool_size', { mode: 'number' }).default(0),
    optionsPoolAllocated: bigint('options_pool_allocated', { mode: 'number' }).default(0),

    // Metadata
    currency: varchar('currency', { length: 10 }).notNull().default('USD'),
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_cap_tables_user_id').on(table.userId),
    index('idx_cap_tables_startup_id').on(table.startupId),
  ],
);

export const capTablesRelations = relations(capTables, ({ one, many }) => ({
  user: one(users, {
    fields: [capTables.userId],
    references: [users.id],
  }),
  startup: one(startups, {
    fields: [capTables.startupId],
    references: [startups.id],
  }),
  shareholders: many(capTableShareholders),
  rounds: many(capTableRounds),
  scenarios: many(capTableScenarios),
}));

// ============================================
// SHAREHOLDERS
// ============================================

export const capTableShareholders = pgTable(
  'cap_table_shareholders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    capTableId: uuid('cap_table_id').notNull().references(() => capTables.id, { onDelete: 'cascade' }),

    // Shareholder info
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    shareholderType: varchar('shareholder_type', { length: 50 }).notNull(),

    // Holdings
    commonShares: bigint('common_shares', { mode: 'number' }).notNull().default(0),
    preferredShares: bigint('preferred_shares', { mode: 'number' }).notNull().default(0),
    optionsGranted: bigint('options_granted', { mode: 'number' }).notNull().default(0),
    optionsVested: bigint('options_vested', { mode: 'number' }).notNull().default(0),
    optionsExercised: bigint('options_exercised', { mode: 'number' }).notNull().default(0),

    // Vesting
    vestingStartDate: date('vesting_start_date'),
    vestingCliffMonths: integer('vesting_cliff_months').default(12),
    vestingTotalMonths: integer('vesting_total_months').default(48),

    // Investment details
    investmentAmount: decimal('investment_amount', { precision: 20, scale: 2 }),
    investmentDate: date('investment_date'),
    sharePrice: decimal('share_price', { precision: 20, scale: 6 }),

    // Notes
    notes: text('notes'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_cap_shareholders_cap_table').on(table.capTableId),
    index('idx_cap_shareholders_type').on(table.shareholderType),
  ],
);

export const capTableShareholdersRelations = relations(capTableShareholders, ({ one }) => ({
  capTable: one(capTables, {
    fields: [capTableShareholders.capTableId],
    references: [capTables.id],
  }),
}));

// ============================================
// FUNDING ROUNDS
// ============================================

export const capTableRounds = pgTable(
  'cap_table_rounds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    capTableId: uuid('cap_table_id').notNull().references(() => capTables.id, { onDelete: 'cascade' }),

    // Round info
    name: varchar('name', { length: 100 }).notNull(),
    roundType: varchar('round_type', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('planned'),

    // Financials
    targetRaise: decimal('target_raise', { precision: 20, scale: 2 }),
    amountRaised: decimal('amount_raised', { precision: 20, scale: 2 }).default('0'),
    preMoneyValuation: decimal('pre_money_valuation', { precision: 20, scale: 2 }),
    postMoneyValuation: decimal('post_money_valuation', { precision: 20, scale: 2 }),

    // Share details
    pricePerShare: decimal('price_per_share', { precision: 20, scale: 6 }),
    sharesIssued: bigint('shares_issued', { mode: 'number' }).default(0),

    // SAFE/Convertible specific
    valuationCap: decimal('valuation_cap', { precision: 20, scale: 2 }),
    discountRate: decimal('discount_rate', { precision: 5, scale: 2 }),
    interestRate: decimal('interest_rate', { precision: 5, scale: 2 }),

    // Dates
    roundDate: date('round_date'),
    closeDate: date('close_date'),

    notes: text('notes'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_cap_rounds_cap_table').on(table.capTableId),
    index('idx_cap_rounds_status').on(table.status),
  ],
);

export const capTableRoundsRelations = relations(capTableRounds, ({ one }) => ({
  capTable: one(capTables, {
    fields: [capTableRounds.capTableId],
    references: [capTables.id],
  }),
}));

// ============================================
// SCENARIOS (What-if modeling)
// ============================================

export const capTableScenarios = pgTable(
  'cap_table_scenarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    capTableId: uuid('cap_table_id').notNull().references(() => capTables.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Scenario parameters
    parameters: jsonb('parameters').notNull().default({}),
    
    // Calculated results
    results: jsonb('results').default({}),

    isFavorite: boolean('is_favorite').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_cap_scenarios_cap_table').on(table.capTableId),
  ],
);

export const capTableScenariosRelations = relations(capTableScenarios, ({ one }) => ({
  capTable: one(capTables, {
    fields: [capTableScenarios.capTableId],
    references: [capTables.id],
  }),
}));

// ============================================
// TYPES
// ============================================

export type CapTable = typeof capTables.$inferSelect;
export type NewCapTable = typeof capTables.$inferInsert;

export type CapTableShareholder = typeof capTableShareholders.$inferSelect;
export type NewCapTableShareholder = typeof capTableShareholders.$inferInsert;

export type CapTableRound = typeof capTableRounds.$inferSelect;
export type NewCapTableRound = typeof capTableRounds.$inferInsert;

export type CapTableScenario = typeof capTableScenarios.$inferSelect;
export type NewCapTableScenario = typeof capTableScenarios.$inferInsert;

export type ShareholderType = 'founder' | 'employee' | 'investor' | 'advisor' | 'other';
export type RoundType = 'equity' | 'safe' | 'convertible_note';
export type RoundStatus = 'planned' | 'in_progress' | 'closed';

export interface ScenarioParameters {
  newRound?: {
    amount: number;
    valuation: number;
    type: RoundType;
  };
  optionsPoolIncrease?: number;
  exits?: Array<{
    shareholderId: string;
    shares: number;
    price: number;
  }>;
}

export interface ScenarioResults {
  dilution: Record<string, { before: number; after: number }>;
  newOwnership: Record<string, number>;
  founderDilution: number;
  newInvestorOwnership: number;
  postMoneyValuation: number;
}
