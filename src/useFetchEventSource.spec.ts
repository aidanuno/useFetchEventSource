import { describe, expect, it, vi } from "vitest";
import createFetchMock from "vitest-fetch-mock";
import { renderHook } from "@testing-library/react-hooks";
import { useFetchEventSource } from "./useFetchEventSource";
import { FetchEventSourceState } from ".";

const fetchMocker = createFetchMock(vi);
const testURL = "http://localhost:5173/api/sse";
fetchMocker.dontMock();

describe("useFetchEventSource", async () => {
    it("should open", async () => {
        const { result, waitForNextUpdate } = renderHook(() => useFetchEventSource(testURL, { initiallyOpen: false }));
        expect(result.current.readyState).toBe(FetchEventSourceState.CLOSED);
        result.current.open();
        await waitForNextUpdate();
        expect(result.current.readyState).toBe(FetchEventSourceState.OPEN);
    });
    it("should close", async () => {
        const { result, waitForNextUpdate } = renderHook(() => useFetchEventSource(testURL, { initiallyOpen: true }));
        await waitForNextUpdate();
        expect(result.current.readyState).toBe(FetchEventSourceState.OPEN);
        result.current.close();
        expect(result.current.readyState).toBe(FetchEventSourceState.CLOSED);
    });
    it("should close/open on page visibility change if openWhenHidden: false", async () => {
        //page visible
        Object.defineProperty(document, "visibilityState", {
            value: "visible",
            writable: true
        });
        const { result, waitForNextUpdate } = renderHook(() =>
            useFetchEventSource(testURL, { initiallyOpen: false, openWhenHidden: false })
        );
        result.current.open();
        await waitForNextUpdate();
        expect(result.current.readyState).toBe(FetchEventSourceState.OPEN);
        //page hidden
        Object.defineProperty(document, "visibilityState", {
            value: "hidden",
            writable: true
        });
        document.dispatchEvent(new Event("visibilitychange"));
        expect(result.current.readyState).toBe(FetchEventSourceState.CLOSED);
        //page visible again
        Object.defineProperty(document, "visibilityState", {
            value: "visible",
            writable: true
        });
        document.dispatchEvent(new Event("visibilitychange"));
        await waitForNextUpdate();
        expect(result.current.readyState).toBe(FetchEventSourceState.OPEN);
    });
});
