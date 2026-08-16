import { LoaderCircle } from "lucide-react";
export function Loader({label="Loading"}:{label?:string}){return <span role="status" className="inline-flex items-center gap-2 text-sm text-zinc-400"><LoaderCircle className="spin" size={17} aria-hidden="true"/>{label}</span>;}
