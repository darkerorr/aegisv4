"use client";

import * as ContextMenu from "@radix-ui/react-context-menu";
import { Copy, ExternalLink, FolderOpen, PenLine, Trash2 } from "lucide-react";
import { FileTypeIcon } from "./file-icon";

export interface TreeContextActions {
  open: () => void;
  rename: () => void;
  del: () => void;
  copyPath: () => void;
  reveal: () => void;
}

export function WorkTreeContextMenu({ children, isDir, actions }: { children: React.ReactNode; isDir: boolean; actions: TreeContextActions }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="work-ctx" alignOffset={4}>
          <ContextMenu.Item className="work-ctx__item" onSelect={() => actions.open()}>
            <FolderOpen size={13} />{isDir ? "Open" : "Open"}
          </ContextMenu.Item>
          <ContextMenu.Item className="work-ctx__item" onSelect={() => actions.reveal()}>
            <ExternalLink size={13} />Reveal in explorer
          </ContextMenu.Item>
          <ContextMenu.Separator className="work-ctx__sep" />
          <ContextMenu.Item className="work-ctx__item" onSelect={() => actions.rename()}>
            <PenLine size={13} />Rename
          </ContextMenu.Item>
          <ContextMenu.Item className="work-ctx__item" onSelect={() => actions.del()}>
            <Trash2 size={13} />Delete
          </ContextMenu.Item>
          <ContextMenu.Separator className="work-ctx__sep" />
          <ContextMenu.Item className="work-ctx__item" onSelect={() => actions.copyPath()}>
            <Copy size={13} />Copy path
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export { FileTypeIcon };