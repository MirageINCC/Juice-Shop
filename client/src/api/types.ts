export type ItemKind = "JUICE" | "PRODUCE" | "SEED";
export type MovementType = "ISSUE" | "ADJUST" | "CRAFT_IN" | "CRAFT_OUT";

export interface Item {
  id: string;
  slug: string;
  name: string;
  kind: ItemKind;
  imagePath: string;
  stock: number;
  sortOrder: number;
}

export interface RecipeEntry {
  slug: string;
  amount: number;
}

/** Der komplette App-Zustand. Jede Mutation gibt ihn frisch zurück. */
export interface Inventory {
  items: Item[];
  recipe: RecipeEntry[];
  yieldPerRun: number;
  craftable: number;
}

export interface Movement {
  id: string;
  itemId: string;
  type: MovementType;
  delta: number;
  before: number;
  after: number;
  batchId: string | null;
  createdByName: string;
  createdAt: string;
  item: { name: string; slug: string; imagePath: string };
}

export interface MovementStats {
  perDay: { date: string; in: number; out: number }[];
  recent: Movement[];
  totals: { in: number; out: number };
}

export interface SessionUser {
  id: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
}
