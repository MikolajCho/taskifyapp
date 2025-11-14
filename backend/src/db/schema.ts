import { createId } from "@paralleldrive/cuid2";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const users = pgTable("users", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	email: text("email").notNull().unique(),
	password: text("password").notNull(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	title: text("title").notNull(),
	description: text("description"),
	completed: boolean("completed").default(false).notNull(),
	userId: text("user_id")
		.references(() => users.id)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),
	userId: text("user_id")
		.references(() => users.id)
		.notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	expiresAt: timestamp("expires_at").notNull(),
});

export const insertUserSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
	name: z.string().min(1),
});

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

export const insertTaskSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	completed: z.boolean().default(false),
	userId: z.string(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
