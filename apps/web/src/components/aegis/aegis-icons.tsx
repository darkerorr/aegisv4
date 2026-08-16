import type { ReactNode, SVGProps } from "react";

/* ============================================================================
   AEGIS ICON SYSTEM — a proprietary visual grammar for the Aegis agent.
   Each glyph is drawn on a 24×24 grid with:
     · a 2px geometric stroke (round caps/joins),
     · container shapes that share a 45° cut corner (the "bevel"),
     · a filled diamond "node" marking the focal point of the glyph.
   Icons are pure SVG: no emoji, no third-party icon font, animatable via CSS.
   ========================================================================== */

export type AegisIconName =
  | "think"
  | "read"
  | "search"
  | "edit"
  | "create"
  | "delete"
  | "move"
  | "terminal"
  | "test"
  | "build"
  | "git"
  | "web"
  | "debug"
  | "success"
  | "error"
  | "warning"
  | "file"
  | "folder"
  | "agent"
  | "tool"
  | "plan"
  | "context"
  | "security"
  | "send"
  | "stop"
  | "spark"
  | "progress"
  | "chevron-right"
  | "list";

const NODE: ReactNode = <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" />;

const GLYPHS: Record<AegisIconName, ReactNode> = {
  think: (
    <>
      <path d="M12 3.2l7 4v9.6l-7 4-7-4V7.2z" />
      <path d="M12 8.5v7M8.5 12h7" />
      <circle cx="17.4" cy="6.2" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  read: (
    <>
      <path d="M6 3.2h9l3.8 3.8V20.8H6z" />
      <path d="M15 3.2v3.8h3.8" />
      <path d="M9 12.6h6M9 16h4" strokeDasharray="2.2 2.6" />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="5.8" />
      <path d="M15.2 15.2L20 20" />
      <circle cx="10.8" cy="10.8" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  edit: (
    <>
      <path d="M6.6 17.4L17.4 6.6" />
      <path d="M6.6 17.4l.8-3.9 3.1 3.1z" fill="currentColor" stroke="none" />
      <path d="M17.4 6.6l.9-.9a1.5 1.5 0 0 1 2.1 2.1l-.9.9" />
    </>
  ),
  create: (
    <>
      <path d="M6 3.2h8l3.8 3.8V20.8H6z" />
      <path d="M14 3.2v3.8h3.8" />
      <path d="M10 11h4M12 9v4" />
      {NODE}
    </>
  ),
  delete: (
    <>
      <path d="M6 3.2h8l3.8 3.8V20.8H6z" />
      <path d="M14 3.2v3.8h3.8" />
      <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
    </>
  ),
  move: (
    <>
      <path d="M4.5 8.5H14M10.5 4.5l4 4-4 4" />
      <path d="M19.5 15.5H10M14 11.5l-4 4 4 4" />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  terminal: (
    <>
      <path d="M6.5 9.2l3 3-3 3" />
      <path d="M12.5 15.4h5" />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  test: (
    <>
      <path d="M12 3.2l8 9-8 9-8-9z" />
      <path d="M12 3.8a8.2 8.2 0 0 1 7.7 5.8" />
      <path d="M9.2 12.2l1.9 1.9 3.8-3.8" />
    </>
  ),
  build: (
    <>
      <path d="M12 3.6l8 3-8 3-8-3z" />
      <path d="M4 11.4l8 3 8-3" />
      <path d="M4 17.4l8 3 8-3" />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  git: (
    <>
      <path d="M6 3.5v9a3.5 3.5 0 0 0 3.5 3.5H11" />
      <path d="M11 13l3 3-3 3" />
      <circle cx="6" cy="3.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="6" cy="20.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  web: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5-3.6-8.5s1.2-6.2 3.6-8.5z" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  debug: (
    <>
      <path d="M12 3.2l8 9-8 9-8-9z" />
      <path d="M12 7.2v9.6M8 12h8" />
      <path d="M9 9l-2.4-2.4M15 9l2.4-2.4" />
    </>
  ),
  success: (
    <>
      <path d="M12 3.2l8 9-8 9-8-9z" />
      <path d="M9.2 12.2l1.9 1.9 3.8-3.8" />
    </>
  ),
  error: (
    <>
      <path d="M12 3.2l8 9-8 9-8-9z" />
      <path d="M9.6 9.6l4.8 4.8M14.4 9.6l-4.8 4.8" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.6l8.4 15.2H3.6z" />
      <path d="M12 9.6v4.2" />
      <path d="M12 16.9h.01" strokeWidth="2.4" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.2h9l3.8 3.8V20.8H6z" />
      <path d="M15 3.2v3.8h3.8" />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  folder: (
    <>
      <path d="M3.4 7.6h6l2 2.6h9.2v8.6a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4z" />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  agent: (
    <>
      <path d="M12 3.2l8 9-8 9-8-9z" />
      <path d="M12 7.6v4.2" />
      <path d="M9.8 12h4.4" />
      <circle cx="12" cy="3.6" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  tool: (
    <>
      <path d="M12 3.2l7.8 4.5v9L12 21l-7.8-4.5v-9z" />
      <path d="M12 9.2l2.8 2.8-2.8 2.8-2.8-2.8z" />
    </>
  ),
  plan: (
    <>
      <path d="M4.5 6h5.5M10 12h6.5M16.5 18H20" />
      <path d="M4.5 6l1.3 1.3L4.5 8.6 3.2 7.3z" fill="currentColor" stroke="none" />
      <path d="M10 12l1.3 1.3L10 14.6 8.7 13.3z" fill="currentColor" stroke="none" />
      <path d="M16.5 18l1.3 1.3L16.5 20.6 15.2 19.3z" fill="currentColor" stroke="none" />
    </>
  ),
  context: (
    <>
      <path d="M9.5 4.5c2 1.9 2 4 0 6 2 1.9 2 4 0 6M14.5 4.5c-2 1.9-2 4 0 6-2 1.9-2 4 0 6" />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  security: (
    <>
      <path d="M12 3.2l7 2.6v6.2c0 4.3-2.9 7.3-7 9.2-4.1-1.9-7-4.9-7-9.2V5.8z" />
      <path d="M9.4 12.2l1.8 1.8 3.6-3.6" />
    </>
  ),
  send: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 13.2l4-4 4 4M12 9.4v6.6" />
    </>
  ),
  stop: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5h5v5h-5z" />
    </>
  ),
  spark: (
    <>
      <path d="M12 4l1.4 6.6L20 12l-6.6 1.4L12 20l-1.4-6.6L4 12l6.6-1.4z" />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  progress: (
    <>
      <path d="M12 3.2a8.8 8.8 0 1 1-7.8 12.7" />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  "chevron-right": <path d="M9.2 6.5L15.5 12l-6.3 5.5" />,
  list: (
    <>
      <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20" />
      <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth="2.6" />
    </>
  ),
};

interface AegisIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: AegisIconName;
  size?: number;
  title?: string;
}

export function AegisIcon({ name, size = 16, title, ...rest }: AegisIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {GLYPHS[name]}
    </svg>
  );
}

export function AegisIconList(): AegisIconName[] {
  return Object.keys(GLYPHS) as AegisIconName[];
}

/** Map a local-agent tool action onto the Aegis glyph that represents it. */
export function iconForAction(action: string): AegisIconName {
  switch (action) {
    case "search":
      return "search";
    case "read":
      return "read";
    case "edit":
      return "edit";
    case "create":
      return "create";
    case "delete":
      return "delete";
    case "rename":
    case "move":
    case "copy":
      return "move";
    case "run":
      return "terminal";
    case "list":
      return "list";
    case "test":
      return "test";
    case "build":
      return "build";
    case "git":
      return "git";
    case "web":
    case "webSearch":
      return "web";
    case "debug":
      return "debug";
    case "plan":
      return "plan";
    default:
      return "tool";
  }
}

/** Map a local-agent tool name onto its Aegis glyph. */
export function iconForTool(tool: string): AegisIconName {
  switch (tool) {
    case "searchFiles":
      return "search";
    case "readFile":
      return "read";
    case "editFile":
      return "edit";
    case "writeFile":
      return "create";
    case "deleteFile":
    case "deleteFolder":
      return "delete";
    case "moveFile":
    case "copyFile":
      return "move";
    case "runCommand":
      return "terminal";
    case "listFiles":
      return "list";
    case "webSearch":
      return "web";
    default:
      return "tool";
  }
}