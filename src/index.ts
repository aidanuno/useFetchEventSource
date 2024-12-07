import { useFetchEventSource, FetchEventSourceOpenError, DefaultRetryInterval } from "./useFetchEventSource";

/**
 * The state of the FetchEventSource connection.
 */
export enum FetchEventSourceState {
    CONNECTING,
    OPEN,
    CLOSED
}

/**
 * A message received from the FetchEventSource connection.
 * Properties id, event, or data will be initialised to an empty string if not provided by the server.
 * https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
 */
export type FetchEventSourceMessage = {
    id: string;
    event: string;
    data: string;
    retry?: number;
};

export type FetchEventSourceConfig = {
    /**
     * The fetch request init options to use when making the request.
     * Whenever these are changed, the connection will be closed and reopened.
     * For example, a new Authorization header would require a new connection.
     */
    fetchRequestInit?: Omit<RequestInit, "signal" | "headers"> & { headers?: Record<string, string> };
    /**
     * If true, the event source connection will remain open even when the document is hidden. Default is true.
     * Uses the Page Visibility API. https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
     */
    openWhenHidden?: boolean;
    /**
     * Whether to open the connection immediately. Default is true, same as native EventSource.
     */
    initiallyOpen?: boolean;
    /**
     * If neither onClose nor onError are defined, the connection will be retried using this interval.
     * If defined, this will override the default interval of 1000ms.
     */
    defaultRetryInterval?: number;
    /** The Fetch function implementation to use. Defaults to window.fetch */
    fetch?: typeof fetch;
    /**
     * Called when a response is received. Use this to validate that the response
     * actually matches what you expect (and throw if it doesn't.) If not provided,
     * will default to a basic validation to ensure the content-type is text/event-stream.
     */
    onOpen?: (response: Response) => Promise<void>;
    /**
     * Called when a message is received. NOTE: Unlike the default browser
     * EventSource.onmessage, this callback is called for _all_ events,
     * even ones with a custom `event` field.
     */
    onEventMessage?: (ev: FetchEventSourceMessage) => void;
    /**
     * Called when the server terminates the connection (without error), response finished.
     * @returns A number representing the interval (in milliseconds) after which the request will retry, or false to end retrying.
     */
    onClose?: () => number | false;
    /**
     * Called when there is any error making the request / processing messages /
     * handling callbacks etc. Use this to control the retry strategy: Return false to stop retrying based on error.
     * If this callback is undefined, the connection will be retried using the given retry interval (default or value provided in latest event message).
     *
     * @param err - The error that occurred.
     * @param retries - The number of consecutive retries that have been attempted. Reset to 0 on successful connection (open).
     * @param givenRetryInterval - Default value or the retry value from the latest event message if sent from server.
     * @returns A number representing the interval (in milliseconds) after which the request will retry, or false to end retrying.
     */
    onError?: (
        err: FetchEventSourceOpenError | any, //eslint-disable-line @typescript-eslint/no-explicit-any
        retries: number
    ) => number | false;
};

/**
 * Type representing the return value of the useFetchEventSource hook.
 */
export interface UseFetchEventSourceReturn {
    /**
     * The last event message received.
     */
    eventMessage: FetchEventSourceMessage | null;
    /**
     * The ID of the last event received.
     */
    lastEventId: string | null;
    /**
     * The current state of the connection.
     */
    readyState: FetchEventSourceState;
    /**
     * The retry interval in milliseconds. Either the default value (1000ms) or the value provided in the latest event message.
     */
    retryInterval: number;
    /**
     * Function to open the connection.
     */
    open: () => Promise<void>;
    /**
     * Function to close the connection. Will abort any in-progress fetch request.
     * Will also cancel upcoming retries.
     */
    close: () => void;
}

export { useFetchEventSource, FetchEventSourceOpenError, DefaultRetryInterval };
