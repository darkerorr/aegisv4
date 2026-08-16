"use client";
import * as Menu from "@radix-ui/react-context-menu";
export const ContextMenu=Menu.Root; export const ContextMenuTrigger=Menu.Trigger;
export function ContextMenuContent({children}:{children:React.ReactNode}){return <Menu.Portal><Menu.Content className="z-50 min-w-44 rounded-xl border border-white/15 bg-[#0b0b0b] p-1.5 shadow-2xl">{children}</Menu.Content></Menu.Portal>}
export function ContextMenuItem(props:React.ComponentProps<typeof Menu.Item>){return <Menu.Item className="rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-white/10" {...props}/>;}
