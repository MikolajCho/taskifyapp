declare module "@trpc/server/adapters/express" {
	import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
	export function createExpressMiddleware(
		options: CreateExpressContextOptions,
	): unknown;
}
