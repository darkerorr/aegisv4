import { forwardRef, type ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" };
export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant="secondary", size="md", className="", ...props }, ref) {
  return <button ref={ref} className={`button focus-ring button-${variant} ui-${size} ${className}`} {...props} />;
});
