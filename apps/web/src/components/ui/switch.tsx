"use client";
import * as SwitchPrimitive from "@radix-ui/react-switch";
export function Switch(props:React.ComponentProps<typeof SwitchPrimitive.Root>){return <SwitchPrimitive.Root className="relative h-6 w-11 rounded-full border border-white/15 bg-white/10 data-[state=checked]:bg-white" {...props}><SwitchPrimitive.Thumb className="block size-4 translate-x-1 rounded-full bg-white transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-black"/></SwitchPrimitive.Root>;}
