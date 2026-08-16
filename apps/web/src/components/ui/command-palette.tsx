"use client";
import { Command,Search } from "lucide-react";
import { Dialog,DialogContent,DialogTrigger } from "./dialog";
import { Input } from "./input";
export function CommandPalette({children}:{children?:React.ReactNode}){return <Dialog><DialogTrigger asChild>{children||<button className="button button-secondary"><Command size={16}/>Command palette</button>}</DialogTrigger><DialogContent title="Command palette" description="Navigate Aegis without leaving the keyboard."><label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16}/><Input className="pl-9" placeholder="Search commands…" autoFocus/></label><div className="mt-4 rounded-xl border border-white/10 p-8 text-center text-sm text-zinc-500">Start typing to search.</div></DialogContent></Dialog>}
