"use client";
import * as PopoverPrimitive from "@radix-ui/react-popover";
export const Popover=PopoverPrimitive.Root; export const PopoverTrigger=PopoverPrimitive.Trigger;
export function PopoverContent(props:React.ComponentProps<typeof PopoverPrimitive.Content>){return <PopoverPrimitive.Portal><PopoverPrimitive.Content sideOffset={8} className={["z-50 rounded-xl border border-white/15 bg-[#0a0a0a] p-4 shadow-2xl outline-none",props.className].filter(Boolean).join(" ")} {...props}/></PopoverPrimitive.Portal>}
