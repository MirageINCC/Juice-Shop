/**
 * `iconsax` liefert ein natives Custom Element, kein React-Paket. React kennt das Tag
 * nicht von sich aus — diese Deklaration macht es für TSX bekannt.
 */
import type React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "iconsax-icon": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        name: string;
        type?: string;
        size?: string;
        color?: string;
      };
    }
  }
}
