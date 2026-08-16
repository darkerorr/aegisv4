import type { HTMLAttributes } from "react";
export function Badge({className="",...props}:HTMLAttributes<HTMLSpanElement>){return <span className={`inline-flex items-center rounded-full border border-white/10 bg-white/[.045] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.12em] text-zinc-300 ${className}`} {...props}/>;}
