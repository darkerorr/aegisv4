export type TokenKind = "keyword" | "string" | "comment" | "number" | "function" | "type" | "property" | "tag" | "punctuation";

export interface Token {
  text: string;
  kind: TokenKind;
}

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break",
  "continue", "class", "extends", "implements", "interface", "type", "enum", "namespace", "import", "export",
  "from", "new", "this", "super", "try", "catch", "finally", "throw", "async", "await", "yield", "of", "in",
  "typeof", "instanceof", "void", "delete", "default", "public", "private", "protected", "readonly", "static",
  "abstract", "get", "set", "null", "undefined", "true", "false", "def", "lambda", "pass", "with", "as", "global",
  "nonlocal", "print", "raise", "except", "finally", "elif", "fn", "mod", "struct", "impl", "match", "use",
  "pub", "self", "Some", "None", "Ok", "Err", "package", "func", "select", "chan", "go", "defer", "range", "map",
  "var", "declare", "const", "mysql", "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "JOIN", "ON",
  "BEGIN", "END", "DEFINE", "PRAGMA", "CREATE", "TABLE", "INDEX", "DROP", "ALTER", "SET",
]);

const STRING_START = /^(["'`])/;
const COMMENT_START = /^(\/\/|#|--|<!--|\/\*)/;
const NUMBER = /^(\d+\.?\d*|\.\d+)/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const PUNCTUATION = /^[^\sA-Za-z0-9_$"']/;

function isKeyword(word: string): boolean {
  return KEYWORDS.has(word) || /^(const|let|var|return|if|else|for|while|class|import|export|function|new|this|try|catch|async|await|from|interface|type|enum)$/i.test(word);
}

function isType(word: string): boolean {
  return /^[A-Z][A-Za-z0-9_]*$/.test(word) || ["string", "number", "boolean", "object", "array", "any", "void", "unknown", "never", "Record", "Promise"].includes(word);
}

/** Very lightweight, regex-based tokenizer. Not a full parser: good enough to
 * color-code source while keeping the editor fast and dependency-free. */
export function highlightCode(code: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const length = code.length;

  while (index < length) {
    const rest = code.slice(index);
    const lineEnd = rest.indexOf("\n");

    // Line comment
    const commentMatch = rest.match(COMMENT_START);
    if (commentMatch) {
      const tokenText = lineEnd === -1 ? rest : rest.slice(0, lineEnd + 1);
      tokens.push({ text: tokenText, kind: "comment" });
      index += tokenText.length;
      continue;
    }

    // String literal
    const stringMatch = rest.match(STRING_START);
    if (stringMatch) {
      const quote = stringMatch[1];
      let cursor = 1;
      let escaped = false;
      while (cursor < rest.length) {
        const char = rest[cursor];
        if (escaped) { escaped = false; cursor += 1; continue; }
        if (char === "\\") { escaped = true; cursor += 1; continue; }
        if (char === quote) { cursor += 1; break; }
        if (char === "\n") break;
        cursor += 1;
      }
      const tokenText = rest.slice(0, cursor);
      tokens.push({ text: tokenText, kind: "string" });
      index += tokenText.length;
      continue;
    }

    // Number
    const numberMatch = rest.match(NUMBER);
    if (numberMatch) {
      tokens.push({ text: numberMatch[0], kind: "number" });
      index += numberMatch[0].length;
      continue;
    }

    // Function call pattern: identifier followed by '('
    const fnMatch = rest.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
    if (fnMatch) {
      tokens.push({ text: fnMatch[1], kind: "function" });
      index += fnMatch[1].length;
      continue;
    }

    // Identifier
    const identifierMatch = rest.match(IDENTIFIER);
    if (identifierMatch) {
      const word = identifierMatch[0];
      if (isKeyword(word)) tokens.push({ text: word, kind: "keyword" });
      else if (isType(word)) tokens.push({ text: word, kind: "type" });
      else tokens.push({ text: word, kind: "property" });
      index += word.length;
      continue;
    }

    // HTML tag-ish (works for JSX too)
    if (rest.startsWith("<") && /^<\/?[A-Za-z]/.test(rest)) {
      const tagMatch = rest.match(/^<\/?[A-Za-z][A-Za-z0-9-]*/);
      if (tagMatch) {
        tokens.push({ text: tagMatch[0], kind: "tag" });
        index += tagMatch[0].length;
        continue;
      }
    }

    // Whitespace
    const wsMatch = rest.match(/^\s+/);
    if (wsMatch) {
      tokens.push({ text: wsMatch[0], kind: "punctuation" });
      index += wsMatch[0].length;
      continue;
    }

    // Punctuation
    const punctMatch = rest.match(PUNCTUATION);
    if (punctMatch) {
      tokens.push({ text: punctMatch[0], kind: "punctuation" });
      index += punctMatch[0].length;
      continue;
    }

    // Fallback: advance one char
    tokens.push({ text: rest[0], kind: "punctuation" });
    index += 1;
  }

  return tokens;
}

export function highlightToHtml(code: string, escapeHtml: (text: string) => string): string {
  const tokens = highlightCode(code);
  const classMap: Record<TokenKind, string> = {
    keyword: "sk-keyword",
    string: "sk-string",
    comment: "sk-comment",
    number: "sk-number",
    function: "sk-function",
    type: "sk-type",
    property: "sk-property",
    tag: "sk-tag",
    punctuation: "sk-punct",
  };
  return tokens.map((token) => `<span class="${classMap[token.kind]}">${escapeHtml(token.text)}</span>`).join("");
}

export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
