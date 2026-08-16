"use client";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check,ChevronDown } from "lucide-react";
export const Select=SelectPrimitive.Root;
export function SelectTrigger({placeholder="Select",...props}:React.ComponentProps<typeof SelectPrimitive.Trigger>&{placeholder?:string}){return <SelectPrimitive.Trigger className="field flex items-center justify-between gap-3 text-left" {...props}><SelectPrimitive.Value placeholder={placeholder}/><SelectPrimitive.Icon><ChevronDown size={16}/></SelectPrimitive.Icon></SelectPrimitive.Trigger>}
export function SelectContent({children}: {children:React.ReactNode}){return <SelectPrimitive.Portal><SelectPrimitive.Content className="z-50 overflow-hidden rounded-xl border border-white/15 bg-[#0a0a0a] shadow-2xl"><SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport></SelectPrimitive.Content></SelectPrimitive.Portal>}
export function SelectItem({children,...props}:React.ComponentProps<typeof SelectPrimitive.Item>){return <SelectPrimitive.Item className="relative flex cursor-default items-center rounded-lg py-2 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-white/10" {...props}><SelectPrimitive.ItemIndicator className="absolute left-2"><Check size={14}/></SelectPrimitive.ItemIndicator><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText></SelectPrimitive.Item>}
