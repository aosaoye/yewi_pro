"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = __importDefault(require("typescript"));
const vite_tsconfig_paths_1 = __importDefault(require("vite-tsconfig-paths"));
const config_1 = require("vitest/config");
function typescriptDecoratorPlugin() {
    return {
        name: 'ts-decorator-metadata',
        enforce: 'pre',
        transform(code, id) {
            if (!id.endsWith('.ts') || id.endsWith('.d.ts') || id.includes('node_modules')) {
                return null;
            }
            const result = typescript_1.default.transpileModule(code, {
                fileName: id,
                compilerOptions: {
                    module: typescript_1.default.ModuleKind.ESNext,
                    target: typescript_1.default.ScriptTarget.ES2023,
                    experimentalDecorators: true,
                    emitDecoratorMetadata: true,
                    sourceMap: true,
                    esModuleInterop: true,
                },
            });
            return {
                code: result.outputText,
                map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
            };
        },
    };
}
exports.default = (0, config_1.defineConfig)({
    plugins: [(0, vite_tsconfig_paths_1.default)(), typescriptDecoratorPlugin()],
    test: {
        globals: true,
        root: './',
        setupFiles: ['./test/vitest.setup.ts'],
        include: ['src/**/*.spec.ts'],
    },
});
//# sourceMappingURL=vitest.config.js.map