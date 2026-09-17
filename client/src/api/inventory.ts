import { apiFetch } from "./client";
import type { Inventory } from "./types";

export const fetchInventory = () => apiFetch<Inventory>("/api/inventory");

const post = (path: string, body: unknown) =>
  apiFetch<Inventory>(path, { method: "POST", body: JSON.stringify(body) });

export const issueStock = (id: string, quantity: number) =>
  post(`/api/items/${id}/issue`, { quantity });

export const setStock = (id: string, stock: number) => post(`/api/items/${id}/set`, { stock });

export const bulkSetStock = (entries: { id: string; stock: number }[]) =>
  post("/api/items/bulk-set", { entries });

export const craftJuices = (runs: number) => post("/api/craft", { runs });
