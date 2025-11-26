"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  checked,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-15 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 p-0.5",
        className,
      )}
      style={{
        backgroundColor: checked ? '#22c55e' : '#000000',
        width: '60px',
      }}
      checked={checked}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform border border-slate-200",
        )}
        style={{
          transform: checked ? 'translateX(42px)' : 'translateX(2px)',
        }}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
