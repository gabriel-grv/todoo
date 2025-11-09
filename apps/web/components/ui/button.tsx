"use client";

import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-white text-black hover:bg-neutral-200 border border-neutral-300",
  outline:
    "bg-transparent text-white border border-neutral-500 hover:bg-neutral-900",
  ghost: "bg-transparent text-white hover:bg-neutral-900",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={
          "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed " +
          variantClasses[variant] +
          " " +
          sizeClasses[size] +
          (className ? " " + className : "")
        }
        {...props}
      />
    );
  }
);
Button.displayName = "Button";


