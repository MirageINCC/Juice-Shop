import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
// Registriert das <iconsax-icon>-Custom-Element. Muss vor dem ersten Rendern laufen.
import "iconsax";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { InventoryProvider } from "./inventory/InventoryContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <InventoryProvider>
          <App />
          <Toaster theme="dark" position="bottom-right" richColors />
        </InventoryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
