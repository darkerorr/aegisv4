"use client";
import { motion,useReducedMotion } from "framer-motion";
export function Reveal({children,className="",delay=0}:{children:React.ReactNode;className?:string;delay?:number}){const reduced=useReducedMotion();return <motion.div className={className} initial={reduced?false:{opacity:0,y:28}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:"-8%"}} transition={{duration:.56,delay,ease:[.2,.8,.2,1]}}>{children}</motion.div>}
