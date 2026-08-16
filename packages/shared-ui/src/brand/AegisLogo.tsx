import type { ImgHTMLAttributes } from "react";

export type AegisLogoProps = {
  size?: number;
  className?: string;
  alt?: string;
  src?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "width" | "height" | "alt" | "src" | "className">;

export function AegisLogo({ size = 34, className = "", alt = "Aegis", src = "/brand/aegis-logo.png", ...props }: AegisLogoProps) {
  return <img {...props} src={src} width={size} height={size} className={`aegis-logo ${className}`} alt={alt} />;
}
