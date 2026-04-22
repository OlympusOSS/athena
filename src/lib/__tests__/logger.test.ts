/**
 * Unit tests for lib/logger.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiLogger, authLogger, logger, Logger, LogLevel, replaceConsole, uiLogger } from "../logger";

describe("Logger class", () => {
	let debug: ReturnType<typeof vi.spyOn>;
	let info: ReturnType<typeof vi.spyOn>;
	let warn: ReturnType<typeof vi.spyOn>;
	let error: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		debug = vi.spyOn(console, "debug").mockImplementation(() => {});
		info = vi.spyOn(console, "info").mockImplementation(() => {});
		warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		error = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("logs debug/info/warn/error at DEBUG level", () => {
		const l = new Logger({ level: LogLevel.DEBUG, enableTimestamp: false, enableColors: false });
		l.debug("d");
		l.info("i");
		l.warn("w");
		l.error("e");
		expect(debug).toHaveBeenCalledOnce();
		expect(info).toHaveBeenCalledOnce();
		expect(warn).toHaveBeenCalledOnce();
		expect(error).toHaveBeenCalledOnce();
	});

	it("respects level filtering (WARN skips debug+info)", () => {
		const l = new Logger({ level: LogLevel.WARN });
		l.debug("d");
		l.info("i");
		l.warn("w");
		l.error("e");
		expect(debug).not.toHaveBeenCalled();
		expect(info).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledOnce();
		expect(error).toHaveBeenCalledOnce();
	});

	it("NONE level suppresses all output", () => {
		const l = new Logger({ level: LogLevel.NONE });
		l.debug("d");
		l.info("i");
		l.warn("w");
		l.error("e");
		expect(debug).not.toHaveBeenCalled();
		expect(info).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();
		expect(error).not.toHaveBeenCalled();
	});

	it("setLevel and getLevel work as expected", () => {
		const l = new Logger({ level: LogLevel.DEBUG });
		expect(l.getLevel()).toBe(LogLevel.DEBUG);
		l.setLevel(LogLevel.ERROR);
		expect(l.getLevel()).toBe(LogLevel.ERROR);
	});

	it("prefix is included in formatted output", () => {
		const l = new Logger({ level: LogLevel.INFO, prefix: "MOD", enableTimestamp: false, enableColors: false });
		l.info("msg");
		expect(info.mock.calls[0][0]).toContain("[MOD]");
	});

	it("child() appends prefix with colon", () => {
		const parent = new Logger({ level: LogLevel.INFO, prefix: "A", enableTimestamp: false, enableColors: false });
		const child = parent.child("B");
		child.info("msg");
		expect(info.mock.calls[0][0]).toContain("[A:B]");
	});

	it("child() with no parent prefix uses only child prefix", () => {
		const parent = new Logger({ level: LogLevel.INFO, enableTimestamp: false, enableColors: false });
		const child = parent.child("X");
		child.info("msg");
		expect(info.mock.calls[0][0]).toContain("[X]");
	});

	it("includes timestamp when enableTimestamp=true", () => {
		const l = new Logger({ level: LogLevel.INFO, enableTimestamp: true, enableColors: false });
		l.info("msg");
		// Expect HH:mm:ss.sss pattern in the first argument
		expect(info.mock.calls[0][0]).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}/);
	});

	it("emits color style arg when enableColors + window present", () => {
		// jsdom provides window, so enableColors defaults to true. Force explicitly.
		const l = new Logger({ level: LogLevel.INFO, enableTimestamp: false, enableColors: true });
		l.info("msg");
		// The second argument should be a "color: #..." style string
		expect(typeof info.mock.calls[0][1]).toBe("string");
		expect(info.mock.calls[0][1]).toMatch(/color:/);
	});

	it("logError logs the message from an Error and includes context", () => {
		const l = new Logger({ level: LogLevel.DEBUG, enableTimestamp: false, enableColors: false });
		l.logError(new Error("boom"), "ctx");
		expect(error).toHaveBeenCalled();
		const msg = error.mock.calls[0][0] as string;
		expect(msg).toContain("ctx");
		expect(msg).toContain("boom");
	});

	it("logError handles non-Error values via String()", () => {
		const l = new Logger({ level: LogLevel.ERROR, enableTimestamp: false, enableColors: false });
		l.logError("plain-string");
		expect(error).toHaveBeenCalled();
		const msg = error.mock.calls[0][0] as string;
		expect(msg).toContain("plain-string");
	});

	it("logError prints stack trace when at DEBUG level and error has stack", () => {
		const l = new Logger({ level: LogLevel.DEBUG, enableTimestamp: false, enableColors: false });
		const err = new Error("with-stack");
		l.logError(err);
		// Called at least twice: once for the message, once for the stack
		const callArgs = error.mock.calls.flat();
		expect(callArgs.some((c) => String(c).includes("Stack trace:"))).toBe(true);
	});
});

describe("default logger + specialized loggers", () => {
	beforeEach(() => {
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "debug").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("default logger exposes debug/info/warn/error/logError/child/setLevel/getLevel", () => {
		// These simply shouldn't throw
		const orig = logger.getLevel();
		logger.setLevel(LogLevel.DEBUG);
		logger.debug("d");
		logger.info("i");
		logger.warn("w");
		logger.error("e");
		logger.logError(new Error("e"));
		const child = logger.child("K");
		expect(child).toBeDefined();
		expect(logger.getLevel()).toBe(LogLevel.DEBUG);
		logger.setLevel(orig);
	});

	it("apiLogger / authLogger / uiLogger are Logger instances", () => {
		expect(apiLogger).toBeInstanceOf(Logger);
		expect(authLogger).toBeInstanceOf(Logger);
		expect(uiLogger).toBeInstanceOf(Logger);
	});

	it("replaceConsole maps log/info/warn/error/debug", () => {
		replaceConsole.info("x");
		replaceConsole.log("x");
		replaceConsole.warn("x");
		replaceConsole.error("x");
		replaceConsole.debug("x");
	});
});
