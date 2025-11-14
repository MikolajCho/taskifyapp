import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { serialize } from "cookie";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/db.js";
import { sessions, users } from "../db/schema.js";
import type { Context } from "../trpc.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";

const SESSION_COOKIE_NAME = "taskify-session-id";

const safeResponse = (data: unknown) => {
	const safeData = JSON.parse(
		JSON.stringify(data, (_key, value) => {
			if (value === null || value === undefined) {
				return "";
			}
			if (typeof value === "bigint") {
				return value.toString();
			}
			if (value instanceof Date) {
				return value.toISOString();
			}
			return value;
		}),
	);

	console.log("SAFE RESPONSE:", JSON.stringify(safeData, null, 2));
	return safeData;
};

const createAndSetSession = async (
	userId: string,
	ctx: { res?: { setHeader: (name: string, value: string) => void } },
) => {
	const sessionId = createId();
	const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

	await db.insert(sessions).values({
		id: sessionId,
		userId: userId,
		expiresAt: expiresAt,
	});

	if (ctx.res) {
		ctx.res.setHeader(
			"Set-Cookie",
			serialize(SESSION_COOKIE_NAME, sessionId, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "strict",
				path: "/",
				expires: expiresAt,
			}),
		);
		console.log(`SESSION CREATED: ${sessionId}. Cookie set.`);
	} else {
		console.warn(
			"WARNING: ctx.res is not available. Cookie not set. Must fix in D10.",
		);
	}
};

export const authRouter = router({
	register: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
				password: z.string().min(6),
				name: z.string().min(1),
			}),
		)
		.mutation(
			async (opts: {
				input: { email: string; password: string; name: string };
				ctx: Context;
			}) => {
				console.log("REGISTER - Input:", opts.input);

				try {
					const { email, password, name } = opts.input;

					const existingUsers = await db
						.select()
						.from(users)
						.where(eq(users.email, email));

					if (existingUsers.length > 0) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "User already exists",
						});
					}

					const hashedPassword = await bcrypt.hash(password, 12);

					const [user] = await db
						.insert(users)
						.values({
							email,
							password: hashedPassword,
							name,
						})
						.returning();

					console.log("REGISTER - User created:", user);

					await createAndSetSession(user.id, opts.ctx);

					const response = {
						success: true,
						user: {
							id: String(user.id),
							email: String(user.email),
							name: String(user.name),
						},
					};

					return safeResponse(response);
				} catch (error) {
					console.error("REGISTER ERROR:", error);

					if (error instanceof TRPCError) throw error;

					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message:
							"Registration failed. Check server logs for details. Original Error: " +
							(error as Error).message,
					});
				}
			},
		),

	login: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
				password: z.string().min(1),
			}),
		)
		.mutation(
			async (opts: {
				input: { email: string; password: string };
				ctx: Context;
			}) => {
				console.log("LOGIN - Input:", opts.input);

				try {
					const { email, password } = opts.input;

					const userResults = await db
						.select()
						.from(users)
						.where(eq(users.email, email));

					if (userResults.length === 0) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "Invalid credentials",
						});
					}

					const user = userResults[0];
					console.log("LOGIN - User found:", user);

					const isValidPassword = await bcrypt.compare(password, user.password);

					if (!isValidPassword) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "Invalid credentials",
						});
					}

					await createAndSetSession(user.id, opts.ctx);

					const response = {
						success: true,
						user: {
							id: String(user.id),
							email: String(user.email),
							name: String(user.name),
						},
					};

					return safeResponse(response);
				} catch (error) {
					console.error("LOGIN ERROR:", error);
					if (error instanceof TRPCError) throw error;
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Login failed",
					});
				}
			},
		),

	me: protectedProcedure.query(async ({ ctx }) => {
		console.log("ME - User:", ctx.user.email);

		const response = {
			user: {
				id: String(ctx.user.id),
				email: String(ctx.user.email),
				name: String(ctx.user.name),
			},
		};

		return safeResponse(response);
	}),

	logout: protectedProcedure.mutation(async ({ ctx }) => {
		const sessionId = ctx.req.cookies?.[SESSION_COOKIE_NAME];

		console.log("LOGOUT - Session ID:", sessionId);

		if (sessionId) {
			await db.delete(sessions).where(eq(sessions.id, sessionId));
			console.log("LOGOUT - Session deleted from database");
		}

		if (ctx.res) {
			ctx.res.setHeader(
				"Set-Cookie",
				serialize(SESSION_COOKIE_NAME, "", {
					httpOnly: true,
					secure: process.env.NODE_ENV === "production",
					sameSite: "strict",
					path: "/",
					expires: new Date(0),
				}),
			);
			console.log("LOGOUT - Cookie cleared");
		}

		return safeResponse({
			success: true,
			message: "Logged out successfully",
		});
	}),
});
