"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

export type AegisIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { icon: LucideIcon; label: string; accent?: "neutral"|"cyan"|"blue"|"violet"|"green"|"yellow"|"orange"|"red"; active?: boolean; loading?: boolean; size?: "sm"|"md"|"lg"; variant?: "ghost"|"outline"|"solid"|"glass"; tooltip?: string };
const sizes = { sm: 32, md: 38, lg: 44 };
export const AegisIconButton = forwardRef<HTMLButtonElement,AegisIconButtonProps>(function AegisIconButton({ icon:Icon,label,accent="neutral",active=false,loading=false,size="md",variant="ghost",tooltip,...props },ref){
  const control = <button ref={ref} type="button" aria-label={label} data-active={active} data-variant={variant} className="aegis-icon-button icon-action icon-surface focus-ring" style={{ width:sizes[size],height:sizes[size],"--icon-color":`var(--${accent === "neutral" ? "foreground-soft" : accent})`} as React.CSSProperties} {...props}>{loading?<LoaderCircle aria-hidden="true" className="spin" size={18}/>:<Icon aria-hidden="true" size={18} strokeWidth={1.8} absoluteStrokeWidth/>}</button>;
  return <Tooltip.Root><Tooltip.Trigger asChild>{control}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content sideOffset={7} className="tooltip" role="tooltip">{tooltip||label}<Tooltip.Arrow className="tooltip-arrow"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root>;
});
