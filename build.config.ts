import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
    declaration: true,
    sourceMap: true,
    rollup: {
        emitCJS: true
    },
    externals: ["react"],
    entries: [
        // Plugin
        {
            input: "src/index.ts",
            outDir: "dist",
            name: "index",
            format: "esm",
            ext: "mjs"
        },
        {
            input: "src/index.ts",
            outDir: "dist",
            name: "index",
            format: "cjs",
            ext: "cjs"
        }
    ]
});
