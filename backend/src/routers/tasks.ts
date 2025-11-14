import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { insertTaskSchema, tasks } from "../db/schema.js";
import { protectedProcedure, router } from "../trpc.js";

export const tasksRouter = router({
	create: protectedProcedure
		.input(insertTaskSchema.omit({ userId: true }))
		.mutation(async ({ input, ctx }) => {
			const [task] = await ctx.db
				.insert(tasks)
				.values({
					title: input.title,
					description: input.description,
					userId: ctx.user.id,
				})
				.returning();
			return task;
		}),

	list: protectedProcedure.query(async ({ ctx }) => {
		return await ctx.db
			.select()
			.from(tasks)
			.where(eq(tasks.userId, ctx.user.id))
			.orderBy(tasks.createdAt);
	}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				title: z.string().optional(),
				description: z.string().optional(),
				completed: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { id, ...updates } = input;

			const existingTask = await ctx.db
				.select()
				.from(tasks)
				.where(and(eq(tasks.id, id), eq(tasks.userId, ctx.user.id)))
				.limit(1);

			if (existingTask.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
			}

			const [updatedTask] = await ctx.db
				.update(tasks)
				.set({
					...updates,
					updatedAt: new Date(),
				})
				.where(eq(tasks.id, id))
				.returning();

			return updatedTask;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const _result = await ctx.db
				.delete(tasks)
				.where(and(eq(tasks.id, input.id), eq(tasks.userId, ctx.user.id)));
			return { success: true };
		}),
});
