import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../dist/styles.css";
import { render } from "../utils/render.tsx";

const mockApiFetch = vi.fn();

vi.mock("../../src/lib/api", async () => {
	const actual = await vi.importActual("../../src/lib/api");
	return {
		...actual,
		apiFetch: (...args: unknown[]) => mockApiFetch(...args),
	};
});

const { DeviceAuthorizePage } = await import("../../src/components/DeviceAuthorizePage");

const editor = { id: "user-1", email: "editor@example.com", name: "Editor", role: 40 };
const TRANSPARENT = "rgba(0, 0, 0, 0)";

function respondWith(lookup: Response) {
	mockApiFetch.mockImplementation((input: string) => {
		if (input.endsWith("/auth/me")) return Promise.resolve(Response.json({ data: editor }));
		if (input.includes("/oauth/device/authorize?")) return Promise.resolve(lookup);
		return Promise.reject(new Error(`Unexpected request: ${input}`));
	});
}

function labelGaps(button: HTMLElement): [number, number] {
	const text = document.createTreeWalker(button, NodeFilter.SHOW_TEXT).nextNode()!;
	const range = document.createRange();
	range.selectNodeContents(text);
	const label = range.getBoundingClientRect();
	const box = button.getBoundingClientRect();
	return [label.left - box.left, box.right - label.right];
}

function surfaceColor(element: HTMLElement): string {
	for (let node = element.parentElement; node; node = node.parentElement) {
		const color = getComputedStyle(node).backgroundColor;
		if (color !== TRANSPARENT) return color;
	}
	return TRANSPARENT;
}

describe("DeviceAuthorizePage", () => {
	const originalUrl = window.location.href;

	beforeEach(() => {
		mockApiFetch.mockReset();
		window.history.replaceState(null, "", "/_emdash/admin/device?code=ABCD-EFGH");
	});

	afterEach(() => {
		window.history.replaceState(null, "", originalUrl);
	});

	it("lists the scopes that will be granted and those withheld before approval", async () => {
		respondWith(
			Response.json({
				data: {
					requestedScopes: ["content:read", "admin"],
					grantedScopes: ["content:read"],
				},
			}),
		);

		const screen = await render(<DeviceAuthorizePage />);

		const granted = screen.getByRole("region", {
			name: "This device is requesting permission to use:",
		});
		await expect.element(granted.getByText("Content Read")).toBeInTheDocument();
		expect(granted.getByText("Admin", { exact: true }).query()).toBeNull();

		const withheld = screen.getByRole("region", {
			name: "Also requested, but not available to your role:",
		});
		await expect.element(withheld.getByText("Admin", { exact: true })).toBeInTheDocument();

		await expect.element(screen.getByRole("button", { name: "Authorize" })).toBeEnabled();
	});

	it("normalizes a code supplied in the URL before looking it up", async () => {
		window.history.replaceState(null, "", "/_emdash/admin/device?code=%20abcd-efgh%20");
		respondWith(
			Response.json({
				data: { requestedScopes: ["content:read"], grantedScopes: ["content:read"] },
			}),
		);

		const screen = await render(<DeviceAuthorizePage />);

		await expect.element(screen.getByRole("button", { name: "Authorize" })).toBeEnabled();
		expect(mockApiFetch).toHaveBeenCalledWith(
			"/_emdash/api/oauth/device/authorize?user_code=ABCDEFGH",
		);
	});

	it("disables approval and explains an unknown code", async () => {
		respondWith(
			Response.json(
				{ error: { code: "INVALID_CODE", message: "Invalid or expired code" } },
				{ status: 400 },
			),
		);

		const screen = await render(<DeviceAuthorizePage />);

		await expect
			.element(screen.getByText("This code is invalid or has already been used."))
			.toBeInTheDocument();
		await expect.element(screen.getByRole("button", { name: "Authorize" })).toBeDisabled();
	});

	it("disables approval when the viewer's role permits none of the requested scopes", async () => {
		respondWith(Response.json({ data: { requestedScopes: ["admin"], grantedScopes: [] } }));

		const screen = await render(<DeviceAuthorizePage />);

		await expect
			.element(
				screen.getByText("Your role does not permit any of the permissions this device requested."),
			)
			.toBeInTheDocument();
		await expect.element(screen.getByRole("button", { name: "Authorize" })).toBeDisabled();
	});

	it("renders Authorize as a primary action with its label centered", async () => {
		respondWith(
			Response.json({
				data: { requestedScopes: ["content:read"], grantedScopes: ["content:read"] },
			}),
		);

		const screen = await render(<DeviceAuthorizePage />);

		const authorize = screen.getByRole("button", { name: "Authorize" });
		await expect.element(authorize).toBeEnabled();
		const button = authorize.element() as HTMLElement;

		const [start, end] = labelGaps(button);
		expect(Math.abs(start - end)).toBeLessThan(1);

		const background = getComputedStyle(button).backgroundColor;
		expect(background).not.toBe(TRANSPARENT);
		expect(background).not.toBe(surfaceColor(button));
	});
});
