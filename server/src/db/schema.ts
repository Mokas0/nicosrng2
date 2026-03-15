import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  gold: integer('gold').notNull().default(100),
  hasAutoRoll: integer('has_auto_roll', { mode: 'boolean' }).notNull().default(false),
  hasQuickRoll: integer('has_quick_roll', { mode: 'boolean' }).notNull().default(false),
  lastPassiveGoldAt: text('last_passive_gold_at'),
  createdAt: text('created_at').notNull(),
});

export const auras = sqliteTable('auras', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  rarity: text('rarity').notNull(),
  chance: integer('chance').notNull(),
  visualId: text('visual_id').notNull(),
  description: text('description').notNull(),
});

export const userAuras = sqliteTable('user_auras', {
  userId: text('user_id').notNull(),
  auraId: text('aura_id').notNull(),
  obtainedAt: text('obtained_at').notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuraRow = typeof auras.$inferSelect;
export type UserAura = typeof userAuras.$inferSelect;
