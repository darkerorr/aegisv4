"use client";
import * as ToastPrimitive from "@radix-ui/react-toast";
export const ToastProvider=ToastPrimitive.Provider; export const ToastViewport=()=> <ToastPrimitive.Viewport className="fixed bottom-5 right-5 z-[100] flex w-[min(92vw,380px)] flex-col gap-2"/>;
export function Toast({title,description,...props}:{title:string;description?:string}&React.ComponentProps<typeof ToastPrimitive.Root>){return <ToastPrimitive.Root className="rounded-xl border border-white/15 bg-[#0b0b0b] p-4 shadow-2xl" {...props}><ToastPrimitive.Title className="font-medium">{title}</ToastPrimitive.Title>{description&&<ToastPrimitive.Description className="mt-1 text-sm text-zinc-400">{description}</ToastPrimitive.Description>}</ToastPrimitive.Root>}
