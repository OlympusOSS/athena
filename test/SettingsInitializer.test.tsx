import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsInitializer } from "@/components/SettingsInitializer";

import "./snapshot-setup";

const initializeMock = vi.fn();
const state: { isReady: boolean } = { isReady: false };

vi.mock("@/features/settings/hooks/useSettings", () => ({
	useSettingsStore: (selector: (s: { initialize: () => void; isReady: boolean }) => unknown) =>
		selector({ initialize: initializeMock, isReady: state.isReady }),
}));

beforeEach(() => {
	initializeMock.mockReset();
	state.isReady = false;
});

describe("SettingsInitializer", () => {
	it("calls initialize when isReady is false", () => {
		state.isReady = false;
		render(<SettingsInitializer />);
		expect(initializeMock).toHaveBeenCalledTimes(1);
	});

	it("does not call initialize when isReady is true", () => {
		state.isReady = true;
		render(<SettingsInitializer />);
		expect(initializeMock).not.toHaveBeenCalled();
	});

	it("returns null from component (no DOM output)", () => {
		state.isReady = true;
		const { container } = render(<SettingsInitializer />);
		expect(container.innerHTML).toBe("");
	});
});
