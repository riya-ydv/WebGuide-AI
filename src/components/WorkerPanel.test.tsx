import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkerPanel, workerEndpoint } from "./WorkerPanel";
import { getBackendSession, setBackendSession } from "@/features/assistance/backend-session";

afterEach(() => {
  cleanup();
  setBackendSession(null);
  vi.unstubAllGlobals();
});

it("accepts only explicit HTTPS origins or HTTP loopback, without credentials or paths", () => {
  expect(workerEndpoint(" https://api.example.com/ ")).toBe("https://api.example.com");
  expect(workerEndpoint("http://127.0.0.1:4398")).toBe("http://127.0.0.1:4398");
  for (const value of [
    "http://api.example.com",
    "https://user:secret@example.com",
    "https://example.com/path",
    "https://example.com/?token=secret",
    "javascript:alert(1)",
  ]) {
    expect(() => workerEndpoint(value)).toThrow();
  }
});

it("connects only on request, sends bearer explicitly, and clears credentials and connection when endpoint changes", async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith("/health")
            ? {
                workerConnected: true,
                browserReady: true,
                aiConfigured: false,
              }
            : [],
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<WorkerPanel />);
  fireEvent.change(screen.getByLabelText("Backend URL"), {
    target: { value: "https://trusted.example" },
  });
  fireEvent.change(screen.getByLabelText("Worker access token"), {
    target: { value: "private-session-token" },
  });
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Check worker connection" }));
  await screen.findByText("Worker: connected");
  await waitFor(() => expect(screen.getByLabelText("Backend URL")).not.toBeDisabled());
  expect(fetcher.mock.calls[0]?.[0]).toBe("https://trusted.example/health");
  expect(fetcher).toHaveBeenCalledWith(
    "https://trusted.example/health",
    expect.objectContaining({
      redirect: "error",
      headers: { Authorization: "Bearer private-session-token" },
    }),
  );
  await waitFor(() =>
    expect(getBackendSession()).toEqual({
      endpoint: "https://trusted.example",
      token: "private-session-token",
    }),
  );
  fireEvent.change(screen.getByLabelText("Backend URL"), {
    target: { value: "https://different.example" },
  });
  expect(screen.getByLabelText("Worker access token")).toHaveValue("");
  expect(getBackendSession()).toBeNull();
  expect(screen.getByText("Worker: not connected")).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url]) => url.startsWith("https://different.example"))).toBe(
    false,
  );
  expect(localStorage.length).toBe(0);
});
