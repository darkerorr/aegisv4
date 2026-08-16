import type { HTMLAttributes } from "react";
export function Card({className="",...props}:HTMLAttributes<HTMLDivElement>){return <div className={`surface rounded-[18px] ${className}`} {...props}/>;}
