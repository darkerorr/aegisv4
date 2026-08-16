"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
export const DropdownMenu=Menu.Root; export const DropdownMenuTrigger=Menu.Trigger; export const DropdownMenuSeparator=Menu.Separator;
export function DropdownMenuContent({children,align="end"}:{children:React.ReactNode;align?:"start"|"center"|"end"}){return <Menu.Portal><Menu.Content align={align} sideOffset={7} className="z-50 min-w-48 rounded-xl border border-white/15 bg-[#0b0b0b] p-1.5 shadow-2xl">{children}</Menu.Content></Menu.Portal>}
export function DropdownMenuItem(props:React.ComponentProps<typeof Menu.Item>){return <Menu.Item className="flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white" {...props}/>;}
