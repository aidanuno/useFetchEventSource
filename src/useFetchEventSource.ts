import React, { useCallback, useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import {
    FetchEventSourceConfig,
    UseFetchEventSourceReturn,
    FetchEventSourceMessage,
    FetchEventSourceState
} from "./index";

/**
 * The default retry interval in milliseconds.
 */
export const DefaultRetryInterval = 1000;

/**
 * An error that occurs when trying to open a FetchEventSource connection.
 * @property response - The response that caused the error while establishing the connection using the fetch API.
 */
export class FetchEventSourceOpenError extends Error {
    response: Response;
    constructor(message: string, response: Response) {
        super(message);
        this.response = response;
    }
}

/**
 * A custom hook that combines the functionality of `useState` and `useRef`.
 * It provides a state variable, a function to update the state, and a ref object
 * that always holds the current state value.
 *
 * @template T - The type of the state.
 * @param {T} initialState - The initial state value.
 * @returns {[T, (newState: T) => void, React.RefObject<T>]} - An array containing the state,
 * a function to update the state and the ref object holding the current state.
 */
const useStateRef = <T>(initialState: T) => {
    const [state, setState] = useState(initialState);
    const ref = useRef<T>(initialState);
    const setStateRef = useCallback((newState: T) => {
        ref.current = newState;
        setState(newState);
    }, []);
    return [state, setStateRef, ref as React.RefObject<T>] as const;
};

export const useFetchEventSource = (input: RequestInfo, config?: FetchEventSourceConfig): UseFetchEventSourceReturn => {
    const abortController = useRef<AbortController | null>(null);
    const lastEventId = useRef<string | null>(null);
    const retryTimeoutId = useRef<number | null>(null);
    const explicitlyOpen = useRef(config?.initiallyOpen ?? true);
    const errorRetries = useRef(0);
    const retryInterval = useRef(config?.defaultRetryInterval ?? DefaultRetryInterval);
    const hidden = useRef(false);
    const [_, setReadyState, readyStateRef] = useStateRef<FetchEventSourceState>(FetchEventSourceState.CLOSED);
    const [eventMessage, setEventMessage] = useState<FetchEventSourceMessage | null>(null);

    const { headers, ...rest } = config?.fetchRequestInit || {};

    const close = useCallback(() => {
        explicitlyOpen.current = false;
        abortController.current?.abort();
        _clearRetryTimeout();
        setReadyState(FetchEventSourceState.CLOSED);
    }, [setReadyState]);
    const _clearRetryTimeout = () => {
        if (retryTimeoutId.current) {
            window.clearTimeout(retryTimeoutId.current);
            retryTimeoutId.current = null;
        }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _handleRetry = (err?: any) => {
        let retryIntervalMs: number | false | undefined;
        if (err) {
            retryIntervalMs = config?.onError?.(err, errorRetries.current);
        } else {
            retryIntervalMs = config?.onClose?.();
        }
        if (retryIntervalMs === false) return; //should not retry
        if (retryIntervalMs === undefined) {
            //use default retry interval
            retryIntervalMs = retryInterval.current; //use default retry interval or the latest value from server
        }
        if (err) {
            errorRetries.current++; //increment retries only on error, not on close
        }
        retryTimeoutId.current = window.setTimeout(open, retryIntervalMs);
    };
    const _startStream = async () => {
        abortController.current = new AbortController();
        setReadyState(FetchEventSourceState.CONNECTING);
        const requestHeaders = {
            ...(lastEventId.current && { "Last-Event-ID": lastEventId.current }),
            ...(headers || {})
        };
        await fetchEventSource(input, {
            onopen: async (response) => {
                if (
                    !config?.onOpen &&
                    (!response.ok || response.headers.get("content-type")?.toLowerCase() !== "text/event-stream")
                ) {
                    throw new FetchEventSourceOpenError(
                        `Invalid Server-Sent Events response from server, Status: ${
                            response.status
                        } Content-Type: ${response.headers.get("content-type")}`,
                        response
                    );
                }
                await config?.onOpen?.(response);
                setReadyState(FetchEventSourceState.OPEN);
                errorRetries.current = 0;
            },
            onmessage: (ev) => {
                lastEventId.current = ev.id === "" ? null : ev.id;
                if (ev.retry) {
                    retryInterval.current = ev.retry;
                }
                setEventMessage(ev);
                config?.onEventMessage?.(ev);
            },
            onclose: () => {
                setReadyState(FetchEventSourceState.CLOSED);
                _handleRetry();
            },
            onerror: (err) => {
                throw err;
            },
            signal: abortController.current?.signal,
            openWhenHidden: true,
            headers: requestHeaders,
            ...rest
        }).catch((err) => {
            setReadyState(FetchEventSourceState.CLOSED);
            _clearRetryTimeout();
            _handleRetry(err);
        });
    };
    const open = useCallback(async () => {
        explicitlyOpen.current = true;
        if (readyStateRef.current === FetchEventSourceState.CLOSED) {
            await _startStream();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (explicitlyOpen.current === true && !(hidden && config?.openWhenHidden === false)) {
            _startStream();
        }
        return () => {
            abortController.current?.abort();
            _clearRetryTimeout();
        };
    }, [input, ...Object.values(headers || {}), ...Object.keys(headers || {}), ...Object.values(rest || {})]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        const onVisibilityChange = async () => {
            hidden.current = document.visibilityState === "hidden";
            if (hidden.current) {
                abortController.current?.abort();
                setReadyState(FetchEventSourceState.CLOSED);
            } else {
                if (explicitlyOpen.current === true) {
                    await open();
                }
            }
        };
        if (config?.openWhenHidden === false) {
            document.addEventListener("visibilitychange", onVisibilityChange);
            return () => document.removeEventListener("visibilitychange", onVisibilityChange);
        }
        return;
    }, [config?.openWhenHidden, open, setReadyState]);

    return {
        eventMessage,
        lastEventId: lastEventId.current,
        readyState: readyStateRef.current as FetchEventSourceState,
        retryInterval: retryInterval.current,
        open,
        close
    };
};
