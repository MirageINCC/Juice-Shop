import { apiFetch } from "./client";
import type { ItemKind, MovementStats } from "./types";

export const fetchMovements = (kind: ItemKind, days = 30) =>
  apiFetch<MovementStats>(`/api/movements?kind=${kind}&days=${days}`);
