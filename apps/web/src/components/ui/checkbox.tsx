"use client";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
export function Checkbox(props:React.ComponentProps<typeof CheckboxPrimitive.Root>){return <CheckboxPrimitive.Root className="grid size-5 place-items-center rounded border border-white/25 bg-black focus-ring" {...props}><CheckboxPrimitive.Indicator><Check size={14}/></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>;}
