#!/usr/bin/env node
/**
 * Generate typed SDK definitions from the committed OpenAPI snapshot.
 *
 * Source of truth: openapi/openapi.v1.json (synced from jaano-auth by the
 * "sdk-spec-sync" workflow). This repo has no dependency on the backend code.
 *
 * Usage:
 *   node scripts/generate-sdks.mjs          # write generated files
 *   node scripts/generate-sdks.mjs --check  # exit 1 if any generated file is stale
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SPEC_PATH = path.join(REPO_ROOT, "openapi", "openapi.v1.json");
const CHECK_ONLY = process.argv.includes("--check");

const SPEC = JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"));
const API_VERSION = SPEC.info.version;

// ── Spec validation ──────────────────────────────────────────────────────────
function collectRefs(node, out = []) {
  if (Array.isArray(node)) node.forEach((item) => collectRefs(item, out));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") out.push(value);
      else collectRefs(value, out);
    }
  }
  return out;
}

function resolvePointer(spec, ref) {
  return ref
    .slice(2)
    .split("/")
    .reduce((node, key) => (node == null ? undefined : node[key]), spec);
}

function validateSpec(spec) {
  assert.match(String(spec.openapi), /^3\.1\./, "Snapshot must be OpenAPI 3.1.x");
  assert.match(String(spec.info?.version), /^\d+\.\d+\.\d+$/, "info.version must be semver");
  const unresolved = collectRefs(spec).filter((r) => resolvePointer(spec, r) === undefined);
  assert.deepEqual(unresolved, [], `Unresolved $ref values in snapshot: ${unresolved.join(", ")}`);
}

validateSpec(SPEC);

// ── OpenAPI schema -> TypeScript ─────────────────────────────────────────────
function tsType(schema, indent = "") {
  if (!schema || typeof schema !== "object") return "unknown";
  if (schema.$ref) return schema.$ref.split("/").pop();
  if (Array.isArray(schema.allOf)) return schema.allOf.map((s) => tsType(s, indent)).join(" & ");
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    return (schema.oneOf || schema.anyOf).map((s) => tsType(s, indent)).join(" | ");
  }
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (Array.isArray(schema.enum)) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (Array.isArray(schema.type)) {
    return schema.type.map((t) => tsType({ ...schema, type: t }, indent)).join(" | ");
  }
  switch (schema.type) {
    case "null":
      return "null";
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `Array<${tsType(schema.items, indent)}>`;
    case "object": {
      const props = schema.properties;
      if (!props || Object.keys(props).length === 0) {
        if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
          return `Record<string, ${tsType(schema.additionalProperties, indent)}>`;
        }
        return "Record<string, unknown>";
      }
      const req = new Set(schema.required || []);
      const next = indent + "  ";
      const lines = Object.entries(props).map(([k, v]) => {
        const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
        return `${next}${key}${req.has(k) ? "" : "?"}: ${tsType(v, next)};`;
      });
      return `{\n${lines.join("\n")}\n${indent}}`;
    }
    default:
      return "unknown";
  }
}

function renderTypeScriptTypes(spec) {
  const schemas = spec.components?.schemas || {};
  const blocks = Object.entries(schemas).map(([name, schema]) => `export type ${name} = ${tsType(schema)};`);
  return [
    "// AUTO-GENERATED from openapi/openapi.v1.json. DO NOT EDIT.",
    `// OpenAPI version: ${spec.info.version}`,
    "",
    `export const OPENAPI_VERSION = ${JSON.stringify(spec.info.version)} as const;`,
    "",
    ...blocks,
    "",
  ].join("\n");
}

// ── OpenAPI schema -> Python TypedDicts ──────────────────────────────────────
const PY_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class",
  "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
  "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
  "try", "while", "with", "yield",
]);

function isValidPyIdent(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !PY_KEYWORDS.has(name);
}

function pyType(schema) {
  if (!schema || typeof schema !== "object") return "Any";
  if (schema.$ref) return JSON.stringify(schema.$ref.split("/").pop());
  if (Array.isArray(schema.allOf)) return "dict[str, Any]";
  if (schema.const !== undefined) return `Literal[${JSON.stringify(schema.const)}]`;
  if (Array.isArray(schema.enum)) return `Literal[${schema.enum.map((v) => JSON.stringify(v)).join(", ")}]`;
  if (Array.isArray(schema.type)) {
    const nonNull = schema.type.filter((t) => t !== "null");
    const nullable = schema.type.includes("null");
    const base =
      nonNull.length === 1
        ? pyType({ ...schema, type: nonNull[0] })
        : `Union[${nonNull.map((t) => pyType({ ...schema, type: t })).join(", ")}]`;
    return nullable ? `Optional[${base}]` : base;
  }
  switch (schema.type) {
    case "null":
      return "None";
    case "string":
      return "str";
    case "integer":
      return "int";
    case "number":
      return "float";
    case "boolean":
      return "bool";
    case "array":
      return `list[${pyType(schema.items)}]`;
    case "object":
      if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        return `dict[str, ${pyType(schema.additionalProperties)}]`;
      }
      return "dict[str, Any]";
    default:
      return "Any";
  }
}

function emitPyTypedDict(lines, name, props) {
  const entries = Object.entries(props);
  if (entries.every(([k]) => isValidPyIdent(k))) {
    lines.push(`class ${name}(TypedDict, total=False):`);
    for (const [propName, propSchema] of entries) lines.push(`    ${propName}: ${pyType(propSchema)}`);
  } else {
    // Functional syntax for keys that are Python keywords (e.g. "from").
    lines.push(`${name} = TypedDict(`);
    lines.push(`    ${JSON.stringify(name)},`);
    lines.push("    {");
    for (const [propName, propSchema] of entries) {
      lines.push(`        ${JSON.stringify(propName)}: ${pyType(propSchema)},`);
    }
    lines.push("    },");
    lines.push("    total=False,");
    lines.push(")");
  }
  lines.push("");
}

function renderPythonTypes(spec) {
  const schemas = spec.components?.schemas || {};
  const lines = [
    '"""AUTO-GENERATED from openapi/openapi.v1.json. DO NOT EDIT."""',
    "from __future__ import annotations",
    "",
    "from typing import Any, Literal, Optional, TypedDict, Union",
    "",
    `OPENAPI_VERSION: str = ${JSON.stringify(spec.info.version)}`,
    "",
  ];

  for (const [name, schema] of Object.entries(schemas)) {
    if (schema.type === "object" && schema.properties && Object.keys(schema.properties).length > 0) {
      emitPyTypedDict(lines, name, schema.properties);
    } else if (Array.isArray(schema.allOf)) {
      const merged = {};
      for (const part of schema.allOf) {
        const resolved = part.$ref ? schemas[part.$ref.split("/").pop()] : part;
        if (resolved?.properties) Object.assign(merged, resolved.properties);
      }
      if (Object.keys(merged).length > 0) {
        emitPyTypedDict(lines, name, merged);
      } else {
        lines.push(`${name} = dict[str, Any]`, "");
      }
    } else {
      lines.push(`${name} = ${pyType(schema)}`, "");
    }
  }
  return lines.join("\n");
}

// ── Write / check ────────────────────────────────────────────────────────────
const outputs = [
  {
    file: path.join(REPO_ROOT, "js", "src", "generated", "types.d.ts"),
    content: renderTypeScriptTypes(SPEC),
  },
  {
    file: path.join(REPO_ROOT, "python", "jaano", "_generated_types.py"),
    content: renderPythonTypes(SPEC),
  },
];

let drifted = false;
for (const { file, content } of outputs) {
  const rel = path.relative(REPO_ROOT, file);
  if (CHECK_ONLY) {
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (existing !== content) {
      console.error(`DRIFT: ${rel} is out of date. Run: node scripts/generate-sdks.mjs`);
      drifted = true;
    }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
    console.log(`Generated ${rel} (API v${API_VERSION})`);
  }
}

if (CHECK_ONLY) {
  if (drifted) process.exit(1);
  console.log(`OK: generated SDK types match openapi/openapi.v1.json (v${API_VERSION})`);
}
