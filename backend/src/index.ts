import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { appRouter } from "./routers/app.js";
import { createContext } from "./trpc.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	message: "Zbyt wiele żądań. Spróbuj ponownie za 15 minut.",
	standardHeaders: true,
	legacyHeaders: false,
});
app.use(limiter);

const allowedOrigins = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(",")
	: ["http://localhost:5173"];

app.use(
	cors({
		origin: allowedOrigins,
		credentials: true,
	}),
);

app.use(express.json());
app.use(cookieParser());

app.use(
	"/trpc",
	createExpressMiddleware({
		router: appRouter,
		createContext: createContext,
	}),
);

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
	console.log(`tRPC endpoint: http://localhost:${PORT}/trpc`);
});
