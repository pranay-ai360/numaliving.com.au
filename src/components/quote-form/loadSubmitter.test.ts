import { afterEach, describe, expect, it, vi } from "vitest";

const SUBMIT_MODULE = "@/lib/quotes/submit";

/** Makes loading the sending code fail, the way a chunk that cannot be downloaded does. */
function failLoading(): () => never {
  const factory = vi.fn((): never => {
    throw new Error("Loading chunk failed");
  });
  vi.doMock(SUBMIT_MODULE, factory);
  return factory;
}

function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("loadSubmitter", () => {
  afterEach(() => {
    vi.doUnmock(SUBMIT_MODULE);
    vi.resetModules();
  });

  it("loads the real submitQuoteRequest on demand", async () => {
    // Arrange
    const { loadSubmitter } = await import("./loadSubmitter");
    const { submitQuoteRequest } = await import("@/lib/quotes/submit");

    // Act
    const loaded = await loadSubmitter();

    // Assert
    expect(loaded).toBe(submitQuoteRequest);
  });

  it("reports a failed load to the caller who waits for it", async () => {
    // Arrange
    failLoading();
    const { loadSubmitter } = await import("./loadSubmitter");

    // Act / Assert
    await expect(loadSubmitter()).rejects.toThrow();
  });

  it("swallows a failed early preload, leaving the failure for Send to report", async () => {
    // Arrange
    const factory = failLoading();
    const { preloadSubmitter } = await import("./loadSubmitter");
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    // Act
    preloadSubmitter();
    await nextMacrotask();
    process.off("unhandledRejection", unhandled);

    // Assert
    expect(factory).toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();
  });
});
