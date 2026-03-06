import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({
  children,
  className,
  onClick,
  hoverable = false,
}: CardProps) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={clsx(
        "rounded-lg border border-sentinel-border bg-sentinel-surface p-4",
        hoverable && "hover:border-sentinel-text-muted hover:bg-sentinel-surface-hover",
        onClick && "cursor-pointer text-left",
        className,
      )}
    >
      {children}
    </Component>
  );
}
