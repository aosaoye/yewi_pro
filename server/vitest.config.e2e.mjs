import ts from 'typescript';
import { defineConfig } from 'vitest/config';
function typescriptDecoratorPlugin() {
    return {
        name: 'ts-decorator-metadata',
        enforce: 'pre',
        transform(code, id) {
            if (!id.endsWith('.ts') || id.endsWith('.d.ts') || id.includes('node_modules')) {
                return null;
            }
            const result = ts.transpileModule(code, {
                fileName: id,
                compilerOptions: {
                    module: ts.ModuleKind.ESNext,
                    target: ts.ScriptTarget.ES2023,
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
export default defineConfig({
    plugins: [typescriptDecoratorPlugin()],
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        globals: true,
        root: import.meta.dirname,
        setupFiles: ['./test/vitest.setup.ts'],
        include: ['test/**/*.e2e-spec.ts'],
    },
});
//# sourceMappingURL=vitest.config.e2e.mjs.map