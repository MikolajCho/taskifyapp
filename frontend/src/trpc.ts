const API_BASE = "http://localhost:3001/trpc";

async function trpcCall(
	procedure: string,
	input?: unknown,
	method: string = "POST",
) {
	try {
		const response = await fetch(`${API_BASE}/${procedure}`, {
			method,
			headers: {
				"Content-Type": "application/json",
			},
			body: input ? JSON.stringify(input) : undefined,
			credentials: "include",
		});

		const text = await response.text();
		const result = JSON.parse(text);

		if (!response.ok || result.error) {
			const errorMsg =
				result.error?.message ||
				result.error?.json?.message ||
				"Request failed";
			throw new Error(errorMsg);
		}

		return result.result?.data || result;
	} catch (error) {
		console.error(`TRPC call error for ${procedure}:`, error);
		throw error;
	}
}

export const trpc = {
	auth: {
		me: {
			query: () => trpcCall("auth.me", undefined, "POST"),
		},
		login: {
			mutate: (input: { email: string; password: string }) =>
				trpcCall("auth.login", input),
		},
		register: {
			mutate: (input: { email: string; password: string; name: string }) =>
				trpcCall("auth.register", input),
		},
		logout: {
			mutate: () => trpcCall("auth.logout"),
		},
	},
	tasks: {
		list: {
			query: () => trpcCall("tasks.list", undefined, "POST"),
		},
		create: {
			mutate: (input: { title: string; description?: string }) =>
				trpcCall("tasks.create", input),
		},
		update: {
			mutate: (input: { id: string; title?: string; completed?: boolean }) =>
				trpcCall("tasks.update", input),
		},
		delete: {
			mutate: (id: string) => trpcCall("tasks.delete", { id }),
		},
	},
};
