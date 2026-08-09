import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const roots = ["app", "components", "lib", "utils", "proxy.ts", "scripts"];
const files: string[] = [];
function collect(target: string) {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return;
  if (fs.statSync(absolute).isFile()) {
    files.push(absolute);
    return;
  }
  for (const entry of fs.readdirSync(absolute)) {
    const next = path.join(absolute, entry);
    if (entry === "node_modules" || entry === ".next") continue;
    if (fs.statSync(next).isDirectory()) collect(path.relative(root, next));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) files.push(next);
  }
}
roots.forEach(collect);
const findings: string[] = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  const ast = ts.createSourceFile(
    relative,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "eval"
    )
      findings.push(`${relative}: dynamic eval`);
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Function"
    )
      findings.push(`${relative}: dynamic Function constructor`);
    if (ts.isPropertyAccessExpression(node) && node.name.text === "innerHTML")
      findings.push(`${relative}: innerHTML assignment/access`);
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(ast) === "dangerouslySetInnerHTML"
    )
      findings.push(`${relative}: dangerouslySetInnerHTML`);
    if (ts.isTemplateExpression(node)) {
      const templateText = `${node.head.text}${node.templateSpans.map((span) => span.literal.text).join("")}`;
      if (
        /\b(?:select|insert|update|delete)\b[\s\S]*\bfrom\b/i.test(templateText)
      )
        findings.push(`${relative}: interpolated SQL-like template`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (/sb_(?:secret|publishable)_|sbp_[A-Za-z0-9]/.test(source))
    findings.push(`${relative}: Supabase key-like value in source`);
}
if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log(`AST security audit passed: ${files.length} source files scanned.`);
