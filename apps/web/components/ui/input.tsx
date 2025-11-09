"use client";

import * as React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={
          "w-full rounded-md border border-neutral-700 bg-neutral-950 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 px-3 h-10 " +
          className
        }
        {...props}
      />
    );
  }
);
Input.displayName = "Input";


