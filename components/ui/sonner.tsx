"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast rounded-md border border-neutral-200 bg-white text-neutral-950 shadow-lg",
          description: "text-neutral-500",
          actionButton: "bg-neutral-950 text-white",
          cancelButton: "bg-neutral-100 text-neutral-700"
        }
      }}
      {...props}
    />
  );
};

export { Toaster };
