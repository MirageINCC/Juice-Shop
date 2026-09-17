export type IconVariant = "linear" | "outline" | "bold" | "broken" | "bulk" | "twotone";

interface IconProps {
  /** Name aus dem Iconsax-Set, z.B. "cup" oder "export-arrow-01". */
  name: string;
  size?: number;
  variant?: IconVariant;
  className?: string;
}

/**
 * Kapselt das <iconsax-icon>-Custom-Element. `color="currentColor"` sorgt dafür, dass
 * Icons die Textfarbe ihres Containers erben — damit greifen Hover- und Aktiv-Zustände
 * der Buttons und Navigationseinträge ohne Zutun.
 */
export function Icon({ name, size = 20, variant = "linear", className }: IconProps) {
  return (
    <iconsax-icon
      name={name}
      type={variant}
      size={String(size)}
      color="currentColor"
      className={className}
      style={{ width: size, height: size, flexShrink: 0, display: "inline-flex" }}
    />
  );
}
