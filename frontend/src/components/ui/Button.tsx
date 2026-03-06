import { clsx } from "clsx";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

const VARIANT_STYLES = {
  primary:
    "bg-sentinel-text text-sentinel-bg hover:bg-sentinel-accent active:bg-sentinel-text-secondary",
  secondary:
    "border border-sentinel-border bg-sentinel-surface text-sentinel-text hover:bg-sentinel-surface-hover active:bg-sentinel-surface-active",
  ghost:
    "text-sentinel-text-secondary hover:text-sentinel-text hover:bg-sentinel-surface-hover active:bg-sentinel-surface-active",
} as const;

const SIZE_STYLES = {
  sm: "h-7 px-2.5 text-[11px] gap-1.5 rounded",
  md: "h-8 px-3.5 text-[12px] gap-2 rounded-md",
  lg: "h-10 px-5 text-[13px] gap-2.5 rounded-md",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-medium transition-colors",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        disabled && "pointer-events-none opacity-40",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
