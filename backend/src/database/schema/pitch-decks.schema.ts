import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.schema';
import { startups } from './startups.schema';

// ============================================
// PITCH DECK ANALYSIS
// ============================================

export const pitchDecks = pgTable(
  'pitch_decks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    startupId: uuid('startup_id').references(() => startups.id, { onDelete: 'set null' }),

    // File info
    filename: varchar('filename', { length: 500 }).notNull(),
    originalName: varchar('original_name', { length: 500 }).notNull(),
    storagePath: varchar('storage_path', { length: 1000 }).notNull(),
    fileSize: integer('file_size').notNull(),
    pageCount: integer('page_count').default(0),

    // Analysis status
    status: varchar('status', { length: 50 }).notNull().default('pending'),

    // Analysis results
    analysis: jsonb('analysis').default({}),
    
    // Extracted content
    extractedText: text('extracted_text'),
    slideSummaries: jsonb('slide_summaries').default([]),

    // Metadata
    investorType: varchar('investor_type', { length: 50 }),
    targetRaise: varchar('target_raise', { length: 100 }),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    analyzedAt: timestamp('analyzed_at'),
  },
  (table) => [
    index('idx_pitch_decks_user_id').on(table.userId),
    index('idx_pitch_decks_startup_id').on(table.startupId),
    index('idx_pitch_decks_status').on(table.status),
    index('idx_pitch_decks_created_at').on(table.createdAt),
  ],
);

export const pitchDecksRelations = relations(pitchDecks, ({ one }) => ({
  user: one(users, {
    fields: [pitchDecks.userId],
    references: [users.id],
  }),
  startup: one(startups, {
    fields: [pitchDecks.startupId],
    references: [startups.id],
  }),
}));

// ============================================
// TYPES
// ============================================

export type PitchDeck = typeof pitchDecks.$inferSelect;
export type NewPitchDeck = typeof pitchDecks.$inferInsert;

export type PitchDeckStatus = 'pending' | 'analyzing' | 'completed' | 'failed';
export type InvestorType = 'vc' | 'angel' | 'corporate';

export interface SlideAnalysis {
  slideNumber: number;
  title: string;
  content: string;
  type: 'problem' | 'solution' | 'market' | 'product' | 'traction' | 'team' | 'financials' | 'ask' | 'other';
  score: number;
  feedback: string;
}

export interface SectionScore {
  present: boolean;
  score: number; // 0-100
  feedback: string;
  suggestions: string[];
}

export interface PitchDeckAnalysis {
  overallScore: number; // 0-100
  sections: {
    problem: SectionScore;
    solution: SectionScore;
    market: SectionScore;
    product: SectionScore;
    businessModel: SectionScore;
    traction: SectionScore;
    competition: SectionScore;
    team: SectionScore;
    financials: SectionScore;
    ask: SectionScore;
  };
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  investorFit: {
    vc: number; // 0-100 fit score
    angel: number;
    corporate: number;
  };
  sectorBenchmark: {
    percentile: number;
    avgScore: number;
    topDecksScore: number;
  };
  slideAnalysis: SlideAnalysis[];
}
