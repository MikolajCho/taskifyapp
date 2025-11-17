import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "./trpc";
import "./App.css";

interface User {
	id: string;
	email: string;
	name: string;
}

interface Task {
	id: string;
	title: string;
	description: string | null;
	completed: boolean;
	createdAt: string;
	updatedAt: string;
}

type View = "login" | "register" | "tasks";
type FilterType = "all" | "active" | "completed";
type SortType = "newest" | "oldest" | "alphabetical";

export default function App() {
	const [view, setView] = useState<View>("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [newTask, setNewTask] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [globalLoading, setGlobalLoading] = useState(false);
	const [user, setUser] = useState<User | null>(null);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [editingTask, setEditingTask] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const [filter, setFilter] = useState<FilterType>("all");
	const [sort, setSort] = useState<SortType>("newest");
	const [loadingStates, setLoadingStates] = useState<{
		[key: string]: boolean;
	}>({});

	const taskInputRef = useRef<HTMLInputElement>(null);
	const editInputRef = useRef<HTMLInputElement>(null);

	const showMessage = useCallback(
		(message: string, type: "error" | "success") => {
			if (type === "error") {
				setError(message);
				setSuccess("");
			} else {
				setSuccess(message);
				setError("");
			}
			setTimeout(() => {
				setError("");
				setSuccess("");
			}, 3000);
		},
		[],
	);

	const setLoading = useCallback((key: string, isLoading: boolean) => {
		setLoadingStates((prev) => ({ ...prev, [key]: isLoading }));
	}, []);

	const loadTasks = useCallback(async () => {
		try {
			const result = await trpc.tasks.list.query();
			setTasks(result);
		} catch (_error: unknown) {
			showMessage("Brak zadań do wyświetlenia", "error");
		}
	}, [showMessage]);

	const checkAuth = useCallback(async () => {
		try {
			const result = await trpc.auth.me.query();
			if (result.user) {
				setUser(result.user);
				setView("tasks");
				loadTasks();
				showMessage(`Witaj ponownie, ${result.user.name}!`, "success");
			}
		} catch (_error) {
			console.log("User not authenticated");
		}
	}, [showMessage, loadTasks]);

	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	useEffect(() => {
		if (view === "tasks" && taskInputRef.current) {
			taskInputRef.current.focus();
		}
	}, [view]);

	useEffect(() => {
		if (editingTask && editInputRef.current) {
			editInputRef.current.focus();
			editInputRef.current.select();
		}
	}, [editingTask]);

	const filteredAndSortedTasks = tasks
		.filter((task) => {
			if (filter === "active") return !task.completed;
			if (filter === "completed") return task.completed;
			return true;
		})
		.sort((a, b) => {
			if (sort === "newest")
				return (
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			if (sort === "oldest")
				return (
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				);
			if (sort === "alphabetical") return a.title.localeCompare(b.title);
			return 0;
		});

	const handleLogin = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!email.trim() || !password.trim()) {
			showMessage("Wypełnij wszystkie pola", "error");
			return;
		}

		setGlobalLoading(true);
		try {
			const result = await trpc.auth.login.mutate({ email, password });
			if (result.success) {
				setUser(result.user);
				setView("tasks");
				loadTasks();
				showMessage(`Witaj, ${result.user.name}!`, "success");
			}
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Logowanie nieudane";
			showMessage(message, "error");
		} finally {
			setGlobalLoading(false);
		}
	};

	const handleRegister = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!email.trim() || !password.trim()) {
			showMessage("Wypełnij wszystkie pola", "error");
			return;
		}

		if (password !== confirmPassword) {
			showMessage("Hasła muszą się zgadzać", "error");
			return;
		}

		if (password.length < 6) {
			showMessage("Hasło musi mieć co najmniej 6 znaków", "error");
			return;
		}

		setGlobalLoading(true);
		try {
			const result = await trpc.auth.register.mutate({
				email,
				password,
				name: email.split("@")[0],
			});
			if (result.success) {
				setUser(result.user);
				setView("tasks");
				loadTasks();
				showMessage("Konto utworzone pomyślnie!", "success");
			}
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Rejestracja nieudana";
			showMessage(message, "error");
		} finally {
			setGlobalLoading(false);
		}
	};

	const handleAddTask = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (newTask.trim() === "") {
			showMessage("Wpisz treść zadania", "error");
			return;
		}

		setLoading("add", true);
		try {
			const tempId = Date.now().toString();
			const optimisticTask: Task = {
				id: tempId,
				title: newTask,
				description: "",
				completed: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			setTasks((prev) => [optimisticTask, ...prev]);

			const result = await trpc.tasks.create.mutate({
				title: newTask,
				description: "",
			});

			setTasks((prev) =>
				prev.map((task) => (task.id === tempId ? result : task)),
			);

			setNewTask("");
			showMessage("Zadanie dodane!", "success");
			taskInputRef.current?.focus();
		} catch (error: unknown) {
			setTasks((prev) => prev.filter((task) => !task.id.startsWith("temp")));
			const message = error instanceof Error ? error.message : "Unknown error";
			showMessage(`Błąd podczas dodawania zadania: ${message}`, "error");
		} finally {
			setLoading("add", false);
		}
	};

	const handleRemoveTask = async (id: string) => {
		setLoading(`delete-${id}`, true);

		const taskToRemove = tasks.find((t) => t.id === id);

		try {
			setTasks((prev) => prev.filter((task) => task.id !== id));

			await trpc.tasks.delete.mutate(id);
			showMessage("Zadanie usunięte", "success");
		} catch (error: unknown) {
			if (taskToRemove) {
				setTasks((prev) => [...prev, taskToRemove]);
			}
			const message = error instanceof Error ? error.message : "Unknown error";
			showMessage(`Błąd podczas usuwania zadania: ${message}`, "error");
		} finally {
			setLoading(`delete-${id}`, false);
		}
	};

	const handleToggleComplete = async (id: string, completed: boolean) => {
		setLoading(`toggle-${id}`, true);
		try {
			setTasks((prev) =>
				prev.map((task) => (task.id === id ? { ...task, completed } : task)),
			);

			await trpc.tasks.update.mutate({
				id,
				completed: !completed,
			});

			showMessage(
				`Zadanie ${!completed ? "ukończone" : "wznowione"}!`,
				"success",
			);
		} catch (_error: unknown) {
			setTasks((prev) =>
				prev.map((task) =>
					task.id === id ? { ...task, completed: !completed } : task,
				),
			);
			showMessage("Błąd podczas aktualizacji zadania", "error");
		} finally {
			setLoading(`toggle-${id}`, false);
		}
	};

	const startEditing = (task: Task) => {
		setEditingTask(task.id);
		setEditTitle(task.title);
	};

	const cancelEditing = useCallback(() => {
		setEditingTask(null);
		setEditTitle("");
	}, []);

	const handleEditTask = async (id: string, e?: React.FormEvent) => {
		e?.preventDefault();
		if (editTitle.trim() === "") {
			showMessage("Zadanie nie może być puste", "error");
			return;
		}

		setLoading(`edit-${id}`, true);

		const originalTask = tasks.find((t) => t.id === id);

		try {
			setTasks((prev) =>
				prev.map((task) =>
					task.id === id ? { ...task, title: editTitle } : task,
				),
			);

			await trpc.tasks.update.mutate({
				id,
				title: editTitle,
			});

			setEditingTask(null);
			showMessage("Zadanie zaktualizowane!", "success");
		} catch (error: unknown) {
			if (originalTask) {
				setTasks((prev) =>
					prev.map((task) => (task.id === id ? originalTask : task)),
				);
			}
			const message = error instanceof Error ? error.message : "Unknown error";
			showMessage(`Błąd podczas edycji zadania: ${message}`, "error");
		} finally {
			setLoading(`edit-${id}`, false);
		}
	};

	const handleLogout = async () => {
		setGlobalLoading(true);
		try {
			await trpc.auth.logout.mutate();
			showMessage("Wylogowano pomyślnie", "success");
		} catch (_error) {
			console.error("Logout error:", _error);
		} finally {
			setView("login");
			setEmail("");
			setPassword("");
			setConfirmPassword("");
			setTasks([]);
			setError("");
			setUser(null);
			setGlobalLoading(false);
		}
	};

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && editingTask) {
				cancelEditing();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [editingTask, cancelEditing]);

	const completedCount = tasks.filter((t) => t.completed).length;
	const activeCount = tasks.length - completedCount;

	return (
		<div className="app-container">
			<AnimatePresence mode="wait">
				{view === "login" && (
					<motion.div
						key="login"
						initial={{ opacity: 0, y: 40 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -40 }}
						transition={{ duration: 0.4 }}
						className="card"
					>
						<h1 className="title">Zaloguj się</h1>

						{error && (
							<motion.div
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								className="message error"
							>
								{error}
							</motion.div>
						)}

						<form onSubmit={handleLogin}>
							<input
								type="email"
								placeholder="Email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="input"
								disabled={globalLoading}
								aria-label="Email"
								autoComplete="email"
							/>
							<input
								type="password"
								placeholder="Hasło"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="input"
								disabled={globalLoading}
								aria-label="Hasło"
								autoComplete="current-password"
							/>
							<button type="submit" className="button" disabled={globalLoading}>
								{globalLoading ? "Logowanie..." : "Zaloguj"}
							</button>
						</form>

						<p className="text-small">
							Nie masz konta?{" "}
							<button
								type="button"
								onClick={() => {
									setView("register");
									setError("");
									setSuccess("");
								}}
								className="link"
								disabled={globalLoading}
							>
								Zarejestruj się
							</button>
						</p>
					</motion.div>
				)}

				{view === "register" && (
					<motion.div
						key="register"
						initial={{ opacity: 0, y: 40 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -40 }}
						transition={{ duration: 0.4 }}
						className="card"
					>
						<h1 className="title">Rejestracja</h1>

						{error && (
							<motion.div
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								className="message error"
							>
								{error}
							</motion.div>
						)}

						<form onSubmit={handleRegister}>
							<input
								type="email"
								placeholder="Email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="input"
								disabled={globalLoading}
								aria-label="Email"
								autoComplete="email"
							/>
							<input
								type="password"
								placeholder="Hasło (min. 6 znaków)"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="input"
								disabled={globalLoading}
								aria-label="Hasło"
								autoComplete="new-password"
							/>
							<input
								type="password"
								placeholder="Potwierdź hasło"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								className="input"
								disabled={globalLoading}
								aria-label="Potwierdź hasło"
								autoComplete="new-password"
							/>
							<button type="submit" className="button" disabled={globalLoading}>
								{globalLoading ? "Rejestracja..." : "Zarejestruj"}
							</button>
						</form>

						<p className="text-small">
							Masz już konto?{" "}
							<button
								type="button"
								onClick={() => {
									setView("login");
									setError("");
									setSuccess("");
								}}
								className="link"
								disabled={globalLoading}
							>
								Zaloguj się
							</button>
						</p>
					</motion.div>
				)}

				{view === "tasks" && (
					<motion.div
						key="tasks"
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -30 }}
						transition={{ duration: 0.5 }}
						className="card"
					>
						<div className="header-section">
							<h1 className="title">✨ Witaj, {user?.name || user?.email}!</h1>
							<div className="stats">
								<span className="stat">{activeCount} aktywne</span>
								<span className="stat">{completedCount} ukończone</span>
							</div>
						</div>

						{(error || success) && (
							<motion.div
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								className={`message ${error ? "error" : "success"}`}
							>
								{error || success}
							</motion.div>
						)}

						<form onSubmit={handleAddTask} className="task-form">
							<div className="task-input-container">
								<input
									ref={taskInputRef}
									placeholder="Dodaj nowe zadanie..."
									value={newTask}
									onChange={(e) => setNewTask(e.target.value)}
									className="input"
									disabled={loadingStates.add}
									aria-label="Nowe zadanie"
								/>
								<button
									type="submit"
									className="button-small"
									disabled={loadingStates.add}
								>
									{loadingStates.add ? "➕" : "Dodaj"}
								</button>
							</div>
						</form>

						{tasks.length > 0 && (
							<div className="controls">
								<div className="filter-buttons">
									<button
										type="button"
										className={`filter-btn ${filter === "all" ? "active" : ""}`}
										onClick={() => setFilter("all")}
									>
										Wszystkie
									</button>
									<button
										type="button"
										className={`filter-btn ${filter === "active" ? "active" : ""}`}
										onClick={() => setFilter("active")}
									>
										Aktywne
									</button>
									<button
										type="button"
										className={`filter-btn ${filter === "completed" ? "active" : ""}`}
										onClick={() => setFilter("completed")}
									>
										Ukończone
									</button>
								</div>

								<select
									value={sort}
									onChange={(e) => setSort(e.target.value as SortType)}
									className="sort-select"
									aria-label="Sortuj zadania"
								>
									<option value="newest">Najnowsze</option>
									<option value="oldest">Najstarsze</option>
									<option value="alphabetical">Alfabetycznie</option>
								</select>
							</div>
						)}

						<ul className="task-list" aria-label="Lista zadań">
							{filteredAndSortedTasks.map((task) => (
								<motion.li
									key={task.id}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
									className={`task-item ${task.completed ? "completed" : ""}`}
								>
									<div className="task-content">
										<input
											type="checkbox"
											checked={task.completed}
											onChange={(e) =>
												handleToggleComplete(task.id, e.target.checked)
											}
											disabled={loadingStates[`toggle-${task.id}`]}
											className="task-checkbox"
											aria-label={
												task.completed
													? "Oznacz jako nieukończone"
													: "Oznacz jako ukończone"
											}
										/>

										{editingTask === task.id ? (
											<form
												onSubmit={(e) => handleEditTask(task.id, e)}
												className="edit-form"
											>
												<input
													ref={editInputRef}
													type="text"
													value={editTitle}
													onChange={(e) => setEditTitle(e.target.value)}
													className="edit-input"
													disabled={loadingStates[`edit-${task.id}`]}
													aria-label="Edytuj zadanie"
												/>
												<div className="edit-actions">
													<button
														type="submit"
														className="save-btn"
														disabled={loadingStates[`edit-${task.id}`]}
													>
														{loadingStates[`edit-${task.id}`] ? "💾" : "Zapisz"}
													</button>
													<button
														type="button"
														onClick={cancelEditing}
														className="cancel-btn"
														disabled={loadingStates[`edit-${task.id}`]}
													>
														Anuluj
													</button>
												</div>
											</form>
										) : (
											<>
												<button
													type="button"
													className="task-title"
													onDoubleClick={() => startEditing(task)}
													title="Kliknij dwukrotnie aby edytować"
													style={{
														background: "none",
														border: "none",
														textAlign: "left",
														cursor: "pointer",
														flex: 1,
														padding: 0,
														font: "inherit",
														color: "inherit",
													}}
												>
													{task.title}
												</button>
												<div className="task-actions">
													<button
														type="button"
														onClick={() => startEditing(task)}
														className="edit-btn"
														disabled={loadingStates[`edit-${task.id}`]}
														aria-label="Edytuj zadanie"
													>
														{loadingStates[`edit-${task.id}`] ? "✏️" : "✏️"}
													</button>
													<button
														type="button"
														onClick={() => handleRemoveTask(task.id)}
														className="remove-button"
														disabled={loadingStates[`delete-${task.id}`]}
														aria-label="Usuń zadanie"
													>
														{loadingStates[`delete-${task.id}`] ? "🗑️" : "🗑️"}
													</button>
												</div>
											</>
										)}
									</div>
								</motion.li>
							))}

							{filteredAndSortedTasks.length === 0 && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									className="empty-state"
								>
									{tasks.length === 0
										? "Brak zadań. Dodaj pierwsze zadanie! 📝"
										: `Brak zadań dla filtra "${filter}"`}
								</motion.div>
							)}
						</ul>

						<button
							type="button"
							onClick={handleLogout}
							className="logout-button"
							disabled={globalLoading}
						>
							{globalLoading ? "Wylogowywanie..." : "Wyloguj"}
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
