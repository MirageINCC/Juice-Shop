import { cn } from "@/lib/utils";

/**
 * Die Icons stammen aus Spiel-Screenshots und sind klein (Flaschen ~22x63 px). Sie werden
 * darum nie hochskaliert, sondern in einer dezent abgesetzten Kachel zentriert — dort
 * wirken sie scharf statt matschig.
 */
export function ItemThumb({
  src,
  alt,
  size = 64,
  className,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white/[0.03]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={alt}
        className="object-contain"
        style={{ maxWidth: size - 10, maxHeight: size - 10 }}
      />
    </div>
  );
}
