import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig({
    root: "./demo",
    esbuild: {},
    plugins: [
        react(),
        {
            name: "sse-server",
            configureServer(server) {
                server.middlewares.use(async (req, res, next) => {
                    // custom handle request...
                    if (req.url === "/api/sse") {
                        res.writeHead(200, {
                            "Content-Type": "text/event-stream",
                            "Cache-Control": "no-cache",
                            Connection: "keep-alive"
                        });
                        let id = 1;
                        // Stream events every second
                        const sendEvent = () => {
                            const date = new Date();
                            const formattedTime = date.toLocaleTimeString();
                            res.write(`id: a${id}\n`);
                            res.write(`event: serverTime\n`);
                            res.write(`retry: ${1000 * id}\n`);
                            res.write(`data: ${formattedTime}\n\n`);
                            id++;
                        };
                        sendEvent(); //immediately send the first event
                        const intervalId = setInterval(sendEvent, 1000);
                        req.on("close", () => {
                            console.log("Client disconnected");
                            clearInterval(intervalId);
                            res.end();
                        });
                    } else {
                        next();
                    }
                });
            }
        }
    ],
    test: {
        globals: true,
        environment: "jsdom",
        deps: {
            inline: ["@testing-library/react-hooks", "vitest-fetch-mock"]
        },
        dir: "src"
    }
});
