# useFetchEventSource

React hook for [Azure/fetch-event-source](https://github.com/Azure/fetch-event-source).

## Features

The main aim of this library is to extend the utility of [Azure/fetch-event-source](https://github.com/Azure/fetch-event-source),
making dealing with Server-Sent Events more flexible than with the native EventSource API in React.

From [Azure/fetch-event-source](https://github.com/Azure/fetch-event-source):

<blockquote>
The [default browser EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) imposes several restrictions on the type of request you're allowed to make: the [only parameters](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource#Parameters) you're allowed to pass in are the `url` and `withCredentials`, so:
* You cannot pass in a request body: you have to encode all the information necessary to execute the request inside the URL, which is [limited to 2000 characters](https://stackoverflow.com/questions/417142) in most browsers.
* You cannot pass in custom request headers
* You can only make GET requests - there is no way to specify another method.
* If the connection is cut, you don't have any control over the retry strategy: the browser will silently retry for you a few times and then stop, which is not good enough for any sort of robust application.

This library provides an alternate interface for consuming server-sent events, based on the Fetch API. It is fully compatible with the [Event Stream format](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format), so if you already have a server emitting these events, you can consume it just like before. However, you now have greater control over the request and response so:

-   You can use any request method/headers/body, plus all the other functionality exposed by fetch(). You can even provide an alternate fetch() implementation, if the default browser implementation doesn't work for you.
-   You have access to the response object if you want to do some custom validation/processing before parsing the event source. This is useful in case you have API gateways (like nginx) in front of your application server: if the gateway returns an error, you might want to handle it correctly.
-   If the connection gets cut or an error occurs, you have full control over the retry strategy.

In addition, this library also plugs into the browser's [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) so the connection closes if the document is hidden (e.g., the user minimizes the window), and automatically retries with the last event ID when it becomes visible again. This reduces the load on your server by not having open connections unnecessarily (but you can opt out of this behavior if you want.)

</blockquote>

### useFetchEventSource

-   **Easy Integration**: Simplifies the use of Server-Sent Events (SSE) in React applications.
-   **Customizable**: Provides hooks for handling SSE events such as `onOpen, onError, onEventMessage, onClose`.
-   **Includes all fetch API request features**: Allows you to pass custom fetch request init options, including **headers, method, and body**, ensuring full control over establishing a connection.
-   **Retry Logic**: Ability to implement custom retry logic very easily (e.g. exponential backoff, jitter).
-   **Visibility Handling**: Using the Page Visibility API, close connection to save server resources while your application is hidden from the user.
-   **Sensible defaults**: Follows the default behavior of the native EventSource API (retry on remote close or error), while still being able to customise the behaviour by providing your own callbacks.

## Installation

```sh
npm i @aidanuno/use-fetch-event-source
```

```sh
yarn add @aidanuno/use-fetch-event-source
```

```sh
pnpm add @aidanuno/use-fetch-event-source
```

## Usage

### Retry strategy

-   By default, the hook follows the behavior of the EventSource API, where errors and remotely closed connections will trigger a retry.
-   If the `onClose` and `onError` callbacks aren't defined, the default retry interval is 1000ms.
-   The retry interval will be updated if any event messages provide a retry interval field.
-   You can define custom intervals and control whether to stop retrying by returning either the interval (in milliseconds) or `false` from the `onClose` and `onError` callbacks.

### Detailed example

```tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import type { FetchEventSourceMessage } from "@aidanuno/use-fetch-event-source";
import { useFetchEventSource, FetchEventSourceOpenError } from "@aidanuno/use-fetch-event-source";

class FatalErrorExample extends Error {}

export default function App() {
    const { bearerToken } = useAuth();

    const { open, close, eventMessage, lastEventId, readyState, retryInterval } = useFetchEventSource("/api/v1/sse", {
        /**
         * Called when a response is received. Use this to validate that the response
         * actually matches what you expect (and throw if it doesn't.) If this callback is undefined,
         * will default to a basic validation to ensure the response is valid, will throw FetchEventSourceOpenError if invalid.
         */
        onOpen: async (response) => {
            return;
        },
        /**
         * Called when there is any error making the request / processing messages /
         * handling callbacks etc. Use this to control the retry strategy: Return false to stop retrying based on error.
         * If this callback is undefined, the connection will be retried using the given retry interval (default or value provided in latest event message).
         *
         * @param err - The error that occurred.
         * @param retries - The number of consecutive retries on error events that have been attempted. Resets to 0 on successful connection (open).
         * @returns {number|false} A number representing the interval (in milliseconds) after which the request will retry, or false to end retrying.
         */
        onError: (err, retries) => {
            const maxRetries = 100;
            if (retries >= maxRetries) return false; //stop retrying
            if (err instanceof FatalErrorExample) return false; //stop retrying
            if (err instanceof FetchEventSourceOpenError) {
                /**
                 * Handle invalid SSE response (according to spec https://html.spec.whatwg.org/multipage/server-sent-events.html).
                 * FetchEventSourceOpenError only thrown when onOpen callback is not defined.
                 */
                if (err.response.status === 401) {
                    //request new token...
                }
            }

            const newInterval = retryInterval * Math.pow(2, retries) + Math.random() * 1000; //Exponential backoff with jitter, easy to implement.
            return newInterval;
        },
        /**
         * Called when a message is received. NOTE: Unlike the default browser
         * EventSource.onmessage, this callback is called for _all_ events,
         * even ones with a custom `event` field.
         */
        onEventMessage: (ev) => {
            console.log(ev);
            /**
             * Example event:
             * { data: "data", id: "id", retry: 1000, event: "event" }
             */
        },
        /**
         * Called when the server terminates the connection (without error), response finished.
         * @returns {number|false} A number representing the interval (in milliseconds) after which the request will retry, or false to end retrying.
         */
        onClose: () => false,
        /** The Fetch function to use. Defaults to window.fetch */
        fetch: window.fetch,
        /**
         * If true, the event source connection will remain open even when the document is hidden. Defaults to true. Uses the Page Visibility API. https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
         */
        openWhenHidden: true,
        /**
         * Whether to open the connection immediately. Defaults to true, same as native EventSource.
         */
        initiallyOpen: true,
        /**
         * If neither onClose nor onError are defined, the connection will be retried using this interval otherwise a default interval of 1000ms will be used.
         */
        defaultRetryInterval: 1000,
        /**
         * The fetch request init options to use when making the request.
         * Whenever these are changed, the connection will be closed and reopened.
         * For example, a new Authorization header would require a new connection.
         * To have more control, use the open and close functions while changing fetchRequestInit.
         */
        fetchRequestInit: {
            headers: {
                Authorization: `Bearer ${bearerToken}`
            },
            /**
             * Note the 'Last-Event-ID' header is automatically sent on retry (just like the native EventSource API does), including when closing and then reopening the connection using the close/open functions returned.
             * This can be easily overriden by providing a 'Last-Event-ID' header.
             */
            credentials: "include" //Equivalent to EventSource API EventSourceInit withCredentials: true.
        }
    });

    const [events, setEvents] = useState<FetchEventSourceMessage[]>([]);

    useEffect(() => {
        if (eventMessage) {
            setEvents((prev) => [...prev, eventMessage]);
        }
    }, [eventMessage]);
    return (
        <div>
            <h2>useFetchEventSource</h2>
            <button onClick={open}>Open Connection</button>
            <button onClick={close}>Close Connection</button>
        </div>
    );
}
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/aidanuno/useEventSource).

Commits use https://www.conventionalcommits.org/en/v1.0.0/ format.
