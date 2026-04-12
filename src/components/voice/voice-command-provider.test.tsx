/* @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceQueue, VoiceQueueProvider } from "@/contexts/voice-queue";
import { VoiceCommandProvider } from "./voice-command-provider";

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();
const stopGlobalNow = vi.fn();

let latestVoiceTranscriptHandler: ((transcript: string) => void) | undefined;
let latestBoardCommandHandler:
	| ((cmd: { type: string; label?: string; href?: string }, transcript: string) => void)
	| undefined;
let latestVoiceErrorHandler: ((error: string) => void) | undefined;

vi.mock("sonner", () => ({
	toast: {
		success: (...args: unknown[]) => toastSuccess(...args),
		error: (...args: unknown[]) => toastError(...args),
		info: (...args: unknown[]) => toastInfo(...args),
	},
}));

vi.mock("@/hooks/use-global-voice-commands", () => ({
	useGlobalVoiceCommands: (options: {
		onVoiceTranscript?: (transcript: string) => void;
		onBoardCommand?: (
			cmd: { type: string; label?: string; href?: string },
			transcript: string,
		) => void;
		onError?: (error: string) => void;
	}) => {
		latestVoiceTranscriptHandler = options.onVoiceTranscript;
		latestBoardCommandHandler = options.onBoardCommand;
		latestVoiceErrorHandler = options.onError;
		return { isListening: false, stop: stopGlobalNow };
	},
}));

function Harness({ onQueueChange }: { onQueueChange?: (size: number) => void }) {
	const { queue, commandsEnabled } = useVoiceQueue();

	useEffect(() => {
		onQueueChange?.(queue.length);
	}, [queue.length, onQueueChange]);

	return <div data-testid="commands-enabled">{String(commandsEnabled)}</div>;
}

function renderProvider(onQueueChange?: (size: number) => void) {
	return render(
		<VoiceQueueProvider>
			<VoiceCommandProvider>
				<Harness onQueueChange={onQueueChange} />
			</VoiceCommandProvider>
		</VoiceQueueProvider>,
	);
}

describe("VoiceCommandProvider", () => {
	beforeEach(() => {
		latestVoiceTranscriptHandler = undefined;
		latestBoardCommandHandler = undefined;
		latestVoiceErrorHandler = undefined;
		localStorage.clear();
		localStorage.setItem("activeClassId", "class-123");
		toastSuccess.mockReset();
		toastError.mockReset();
		toastInfo.mockReset();
		stopGlobalNow.mockReset();
		vi.restoreAllMocks();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url === "/api/teacher-settings") {
					return new Response(
						JSON.stringify({
							settings: {
								scheduleDocOpenMode: "new-tab",
								voiceNavMode: "toast",
								voiceAppOpenMode: "confirm",
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				if (url === "/api/coach/voice-agent") {
					return new Response(
						JSON.stringify({
							action: {
								type: "parent_message",
								studentName: "Marcus",
								messageText: "Please call me back.",
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				throw new Error(`Unexpected fetch: ${url}`);
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("routes parent_message commands into the shared queue for coach-page handling", async () => {
		const queueSizes: number[] = [];
		renderProvider((size) => queueSizes.push(size));

		await waitFor(() => expect(latestVoiceTranscriptHandler).toBeTypeOf("function"));
		await act(async () => {
			await latestVoiceTranscriptHandler?.("message Marcus's parent");
		});

		await waitFor(() => {
			expect(queueSizes.at(-1)).toBe(1);
		});
	});

	it("turns commands off after an aborted browser stop and tells the user to re-enable them", async () => {
		renderProvider();

		await waitFor(() => expect(latestVoiceErrorHandler).toBeTypeOf("function"));
		expect(screen.getByTestId("commands-enabled")).toHaveTextContent("true");

		await act(async () => {
			latestVoiceErrorHandler?.("aborted");
		});

		expect(screen.getByTestId("commands-enabled")).toHaveTextContent("false");
		expect(toastError).toHaveBeenCalledWith(
			"Voice commands were stopped by the browser — tap Command to re-enable them",
		);
	});

	it("emits a start-session event when the voice agent returns start_session", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url === "/api/teacher-settings") {
					return new Response(JSON.stringify({ settings: {} }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (url === "/api/coach/voice-agent") {
					return new Response(JSON.stringify({ action: { type: "start_session" } }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				throw new Error(`Unexpected fetch: ${url}`);
			}),
		);

		const startSessionSpy = vi.fn();
		window.addEventListener("voice-start_session", startSessionSpy);
		renderProvider();

		await waitFor(() => expect(latestVoiceTranscriptHandler).toBeTypeOf("function"));
		await act(async () => {
			await latestVoiceTranscriptHandler?.("start class session");
		});

		await waitFor(() => {
			expect(startSessionSpy).toHaveBeenCalledTimes(1);
		});

		window.removeEventListener("voice-start_session", startSessionSpy);
	});

	it("dispatches class creation events for create_class actions", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url === "/api/teacher-settings") {
					return new Response(JSON.stringify({ settings: {} }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (url === "/api/coach/voice-agent") {
					return new Response(
						JSON.stringify({ action: { type: "create_class", label: "Period 3 Math" } }),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				throw new Error(`Unexpected fetch: ${url}`);
			}),
		);

		const createClassSpy = vi.fn();
		window.addEventListener("voice-create_class", createClassSpy);
		renderProvider();

		await waitFor(() => expect(latestVoiceTranscriptHandler).toBeTypeOf("function"));
		await act(async () => {
			await latestVoiceTranscriptHandler?.("create class period 3 math");
		});

		await waitFor(() => {
			expect(createClassSpy).toHaveBeenCalledTimes(1);
		});

		window.removeEventListener("voice-create_class", createClassSpy);
	});

	it("dispatches show-groups events for show_groups actions", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url === "/api/teacher-settings") {
					return new Response(JSON.stringify({ settings: {} }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (url === "/api/coach/voice-agent") {
					return new Response(JSON.stringify({ action: { type: "show_groups" } }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				throw new Error(`Unexpected fetch: ${url}`);
			}),
		);

		const showGroupsSpy = vi.fn();
		window.addEventListener("voice-show_groups", showGroupsSpy);
		renderProvider();

		await waitFor(() => expect(latestVoiceTranscriptHandler).toBeTypeOf("function"));
		await act(async () => {
			await latestVoiceTranscriptHandler?.("show DI groups");
		});

		await waitFor(() => {
			expect(showGroupsSpy).toHaveBeenCalledTimes(1);
		});

		window.removeEventListener("voice-show_groups", showGroupsSpy);
	});

	it("uses toast confirmation for navigation when voiceNavMode is toast", async () => {
		const hrefSetter = vi.fn();
		Object.defineProperty(window, "location", {
			configurable: true,
			value: {
				href: "http://localhost:3000/coach",
				pathname: "/coach",
			},
		});
		Object.defineProperty(window.location, "href", {
			configurable: true,
			get: () => "http://localhost:3000/coach",
			set: hrefSetter,
		});

		renderProvider();

		await waitFor(() => expect(latestVoiceTranscriptHandler).toBeTypeOf("function"));
		await act(async () => {
			await latestVoiceTranscriptHandler?.("go to classes");
		});

		expect(toastSuccess).toHaveBeenCalled();
		expect(hrefSetter).not.toHaveBeenCalled();
	});

	it("honors fetched scheduleDocOpenMode before opening voice-triggered docs", async () => {
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url === "/api/teacher-settings") {
					return new Response(JSON.stringify({ settings: { scheduleDocOpenMode: "new-tab" } }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (url === "/api/coach/voice-agent") {
					return new Response(
						JSON.stringify({
							action: {
								type: "open_doc",
								label: "Lesson Slides",
								url: "https://example.com/slides",
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				throw new Error(`Unexpected fetch: ${url}`);
			}),
		);

		renderProvider();

		await waitFor(() => expect(latestVoiceTranscriptHandler).toBeTypeOf("function"));
		await act(async () => {
			await latestVoiceTranscriptHandler?.("open lesson slides");
		});

		await waitFor(() => {
			expect(openSpy).toHaveBeenCalledWith(
				"https://example.com/slides",
				"_blank",
				"noopener,noreferrer",
			);
		});
		expect(toastSuccess).not.toHaveBeenCalledWith(
			expect.stringContaining("Open Lesson Slides?"),
			expect.anything(),
		);
	});

	it("tries a direct new-tab open first for board app commands in confirm mode", async () => {
		const hrefSetter = vi.fn();
		Object.defineProperty(window, "location", {
			configurable: true,
			value: {
				href: "http://localhost:3000/coach",
				pathname: "/coach",
			},
		});
		Object.defineProperty(window.location, "href", {
			configurable: true,
			get: () => "http://localhost:3000/coach",
			set: hrefSetter,
		});
		const openSpy = vi
			.spyOn(window, "open")
			.mockImplementation(() => ({ closed: false }) as Window);

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url === "/api/teacher-settings") {
					return new Response(JSON.stringify({ settings: { voiceAppOpenMode: "confirm" } }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				throw new Error(`Unexpected fetch: ${url}`);
			}),
		);

		renderProvider();

		await waitFor(() => expect(latestBoardCommandHandler).toBeTypeOf("function"));
		await act(async () => {
			latestBoardCommandHandler?.(
				{
					type: "open_app",
					label: "Pinnacle",
					href: "https://gradebook.dadeschools.net/Pinnacle/Gradebook/",
				},
				"open pinnacle again",
			);
		});

		expect(openSpy).toHaveBeenCalledWith(
			"https://gradebook.dadeschools.net/Pinnacle/Gradebook/",
			"_blank",
			"noopener,noreferrer",
		);
		expect(hrefSetter).not.toHaveBeenCalled();
		expect(toastSuccess).not.toHaveBeenCalledWith("Open Pinnacle?", expect.anything());
	});

	it("shows a non-toast confirm banner for board app opens when toasts are disabled", async () => {
		localStorage.setItem("ui.toastsEnabled", "false");
		const openSpy = vi
			.spyOn(window, "open")
			.mockImplementationOnce(() => null)
			.mockImplementation(() => ({ closed: false }) as Window);

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url === "/api/teacher-settings") {
					return new Response(JSON.stringify({ settings: { voiceAppOpenMode: "confirm" } }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				throw new Error(`Unexpected fetch: ${url}`);
			}),
		);

		renderProvider();

		await waitFor(() => expect(latestBoardCommandHandler).toBeTypeOf("function"));
		await act(async () => {
			latestBoardCommandHandler?.(
				{
					type: "open_app",
					label: "Pinnacle",
					href: "https://gradebook.dadeschools.net/Pinnacle/Gradebook/",
				},
				"open pinnacle",
			);
		});

		expect(await screen.findByText("Open Pinnacle?")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Open" }));
		expect(openSpy).toHaveBeenCalledWith(
			"https://gradebook.dadeschools.net/Pinnacle/Gradebook/",
			"_blank",
			"noopener,noreferrer",
		);
	});

	it("falls back to toast confirmation for doc opens when direct new-tab open is blocked", async () => {
		const openSpy = vi
			.spyOn(window, "open")
			.mockImplementationOnce(() => null)
			.mockImplementation(() => ({ closed: false }) as Window);
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url === "/api/teacher-settings") {
					return new Response(JSON.stringify({ settings: { scheduleDocOpenMode: "toast" } }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (url === "/api/coach/voice-agent") {
					return new Response(
						JSON.stringify({
							action: {
								type: "open_doc",
								label: "Lesson Slides",
								url: "https://example.com/slides",
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				throw new Error(`Unexpected fetch: ${url}`);
			}),
		);

		renderProvider();

		await waitFor(() => expect(latestVoiceTranscriptHandler).toBeTypeOf("function"));
		await act(async () => {
			await latestVoiceTranscriptHandler?.("open lesson slides");
		});

		expect(openSpy).toHaveBeenCalledWith(
			"https://example.com/slides",
			"_blank",
			"noopener,noreferrer",
		);
		expect(toastSuccess).toHaveBeenCalledWith(
			"Open Lesson Slides?",
			expect.objectContaining({
				action: expect.objectContaining({ label: "Open" }),
			}),
		);
	});
});
