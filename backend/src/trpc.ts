import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq, gte } from "drizzle-orm";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import { db } from "./db/db";
import { sessions, users } from "./db/schema";

export interface AuthUser {
	id: string;
	name: string;
	email: string;
	password: string;
	createdAt: Date;
}

export interface Context {
	req: Request;
	res: Response;
	db: typeof db;
	user: AuthUser | null;
}

const SESSION_COOKIE_NAME = "taskify-session-id";

export const createContext = async ({
	req,
	res,
}: {
	req: Request;
	res: Response;
}): Promise<Context> => {
	let user: AuthUser | null = null;
	const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

	if (sessionId) {
		console.log(`Context: Session ID found: ${sessionId}`);

		const session = await db
			.select()
			.from(sessions)
			.where(
				and(eq(sessions.id, sessionId), gte(sessions.expiresAt, new Date())),
			)
			.limit(1);

		if (session.length > 0) {
			const userData = await db
				.select()
				.from(users)
				.where(eq(users.id, session[0].userId))
				.limit(1);

			if (userData.length > 0) {
				user = userData[0] as AuthUser;
				console.log(`Context: User loaded: ${user.email}`);
			}
		}
	}

	return {
		req,
		res,
		db,
		user,
	};
};

const t = initTRPC.context<Context>().create({
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError:
					error.cause instanceof ZodError ? error.cause.flatten() : null,
			},
		};
	},
});

const isAuthed = t.middleware(({ ctx, next }) => {
	if (!ctx.user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Wymagane uwierzytelnienie. Zaloguj się, aby kontynuować.",
		});
	}

	return next({
		ctx: {
			...ctx,
			user: ctx.user,
		},
	});
});

export const protectedProcedure = t.procedure.use(isAuthed);
export const router = t.router;
export const publicProcedure = t.procedure;
