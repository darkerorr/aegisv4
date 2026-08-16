"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs";
export const Tabs=TabsPrimitive.Root;
export function TabsList(props:React.ComponentProps<typeof TabsPrimitive.List>){return <TabsPrimitive.List className="inline-flex rounded-xl border border-white/10 bg-white/[.035] p-1" {...props}/>;}
export function TabsTrigger(props:React.ComponentProps<typeof TabsPrimitive.Trigger>){return <TabsPrimitive.Trigger className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 outline-none data-[state=active]:bg-white/10 data-[state=active]:text-white focus-ring" {...props}/>;}
export const TabsContent=TabsPrimitive.Content;
