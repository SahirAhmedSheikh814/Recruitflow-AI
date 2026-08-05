import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="font-poppins text-sm font-medium text-zinc-700">
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          className={`h-11 rounded-xl border bg-white px-3.5 text-sm text-zinc-900 shadow-sm outline-none transition-all placeholder:text-zinc-400 focus:border-primary focus:ring-4 focus:ring-primary/15 ${
            error ? "border-rejected" : "border-zinc-300 hover:border-zinc-400"
          } ${className}`}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {error ? <p className="text-xs text-rejected">{error}</p> : null}
      </div>
    );
  },
);

TextField.displayName = "TextField";
