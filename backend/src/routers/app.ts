import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { tasksRouter } from "./tasks.js";

export const appRouter = router({
	auth: authRouter,
	tasks: tasksRouter,
});

export type AppRouter = typeof appRouter;
