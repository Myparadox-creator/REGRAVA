/**
 * TypeScript AST Parser for RepoSentinel
 * Uses the official TypeScript Compiler API to extract:
 * - Property access expressions (e.g. response.user_id)
 * - Object destructuring bindings (e.g. const { user_id } = res)
 * - Interface and type property declarations
 * - API endpoint string literals (/api/...)
 * - Frontend test definitions (it/test blocks)
 */

import * as ts from "typescript";
import * as fs from "fs";

interface FileInput {
  path: string;
  content: string;
}

interface PropertyAccessRef {
  file: string;
  line: number;
  column: number;
  property: string;
  expression: string;
  fullSnippet: string;
}

interface TypeFieldRef {
  file: string;
  line: number;
  typeName: string;
  fieldName: string;
  fieldType: string;
}

interface ApiEndpointRef {
  file: string;
  line: number;
  endpoint: string;
  method?: string;
  callContext: string;
}

interface FrontendTestRef {
  file: string;
  line: number;
  testName: string;
  suiteName?: string;
}

interface TypeScriptAnalysisOutput {
  propertyAccesses: PropertyAccessRef[];
  typeFields: TypeFieldRef[];
  apiEndpoints: ApiEndpointRef[];
  tests: FrontendTestRef[];
  warnings: string[];
}

function getScriptKind(filePath: string): ts.ScriptKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (lower.endsWith(".ts")) return ts.ScriptKind.TS;
  if (lower.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function analyzeSourceFile(
  filePath: string,
  content: string,
  output: TypeScriptAnalysisOutput
) {
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(filePath)
    );
  } catch (err: any) {
    output.warnings.push(`Failed to parse TS AST in ${filePath}: ${err?.message || err}`);
    return;
  }

  function getLineCol(node: ts.Node) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    );
    return { line: line + 1, column: character + 1 };
  }

  function getSnippet(node: ts.Node): string {
    const text = node.getText(sourceFile);
    return text.length > 120 ? text.substring(0, 117) + "..." : text;
  }

  let currentSuite: string | undefined = undefined;

  function visit(node: ts.Node) {
    // 1. Property access: e.g. response.user_id or data.user.id
    if (ts.isPropertyAccessExpression(node)) {
      const propName = node.name.text;
      const exprText = node.expression.getText(sourceFile);
      const { line, column } = getLineCol(node);

      output.propertyAccesses.push({
        file: filePath,
        line,
        column,
        property: propName,
        expression: exprText,
        fullSnippet: getSnippet(node.parent || node),
      });
    }

    // 2. Destructuring: const { user_id, name } = response;
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
      const propName = (node.propertyName && ts.isIdentifier(node.propertyName))
        ? node.propertyName.text
        : node.name.text;
      const { line, column } = getLineCol(node);

      output.propertyAccesses.push({
        file: filePath,
        line,
        column,
        property: propName,
        expression: "{destructured}",
        fullSnippet: getSnippet(node.parent || node),
      });
    }

    // 3. Interface declarations: interface User { user_id: number; }
    if (ts.isInterfaceDeclaration(node)) {
      const typeName = node.name.text;
      node.members.forEach((member) => {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          const fieldName = member.name.text;
          const fieldType = member.type ? member.type.getText(sourceFile) : "any";
          const { line } = getLineCol(member);
          output.typeFields.push({
            file: filePath,
            line,
            typeName,
            fieldName,
            fieldType,
          });
        }
      });
    }

    // 4. Type alias declarations: type User = { user_id: number; }
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      const typeName = node.name.text;
      node.type.members.forEach((member) => {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          const fieldName = member.name.text;
          const fieldType = member.type ? member.type.getText(sourceFile) : "any";
          const { line } = getLineCol(member);
          output.typeFields.push({
            file: filePath,
            line,
            typeName,
            fieldName,
            fieldType,
          });
        }
      });
    }

    // 5. String literals containing API routes (e.g. "/api/users")
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const val = node.text;
      if (val.startsWith("/api/") || val.includes("/api/")) {
        const { line } = getLineCol(node);
        output.apiEndpoints.push({
          file: filePath,
          line,
          endpoint: val,
          callContext: getSnippet(node.parent || node),
        });
      }
    }

    // 6. Test definitions: describe, test, it
    if (ts.isCallExpression(node)) {
      const callText = node.expression.getText(sourceFile);
      if (callText === "describe" && node.arguments.length > 0) {
        const firstArg = node.arguments[0];
        if (ts.isStringLiteral(firstArg)) {
          currentSuite = firstArg.text;
        }
      } else if ((callText === "it" || callText === "test") && node.arguments.length > 0) {
        const firstArg = node.arguments[0];
        if (ts.isStringLiteral(firstArg)) {
          const { line } = getLineCol(node);
          output.tests.push({
            file: filePath,
            line,
            testName: firstArg.text,
            suiteName: currentSuite,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function main() {
  const args = process.argv.slice(2);
  let rawInput = "";

  if (args.includes("--stdin")) {
    try {
      rawInput = fs.readFileSync(0, "utf-8");
    } catch (e: any) {
      console.error(JSON.stringify({ error: `Failed to read stdin: ${e.message}` }));
      process.exit(1);
    }
  } else if (args.length > 0 && fs.existsSync(args[0])) {
    const content = fs.readFileSync(args[0], "utf-8");
    rawInput = JSON.stringify({ files: [{ path: args[0], content }] });
  } else {
    try {
      rawInput = fs.readFileSync(0, "utf-8");
    } catch {
      console.error(JSON.stringify({ error: "No input provided" }));
      process.exit(1);
    }
  }

  let parsedInput: { files: FileInput[] };
  try {
    parsedInput = JSON.parse(rawInput);
  } catch (err: any) {
    console.error(JSON.stringify({ error: `JSON parse error: ${err.message}` }));
    process.exit(1);
  }

  const output: TypeScriptAnalysisOutput = {
    propertyAccesses: [],
    typeFields: [],
    apiEndpoints: [],
    tests: [],
    warnings: [],
  };

  for (const f of parsedInput.files || []) {
    analyzeSourceFile(f.path, f.content, output);
  }

  process.stdout.write(JSON.stringify(output, null, 2));
}

main();
