import Image from "next/image";
export function AegisLogo({size=34,priority=false,className=""}:{size?:number;priority?:boolean;className?:string}){return <Image src="/brand/aegis-logo.png" alt="Aegis" width={size} height={size} priority={priority} className={`aegis-logo ${className}`}/>;}
