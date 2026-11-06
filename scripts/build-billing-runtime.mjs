import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

for (const source of ['lib/billing-policy.ts', 'server/billing.ts']) {
  const input = await readFile(source, 'utf8');
  const output = ts.transpileModule(input, {
    fileName: source,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      rewriteRelativeImportExtensions: true,
    },
    reportDiagnostics: true,
  });
  const errors = output.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error) ?? [];
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: name => name,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
  }));
  await writeFile(source.replace(/\.ts$/, '.js'), output.outputText);
}
