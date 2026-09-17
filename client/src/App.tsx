import { Navigate, Route, Routes } from "react-router-dom";
import { AppSidebar } from "@/layout/AppSidebar";
import { TopBar } from "@/layout/TopBar";
import { JuicesPage } from "@/pages/JuicesPage";
import { ProducePage } from "@/pages/ProducePage";
import { SeedsPage } from "@/pages/SeedsPage";

const PAGES = [
  {
    path: "/juices",
    title: "Juices",
    subtitle: "Bestand der acht Saftsorten, Buchungen und Herstellung",
    element: <JuicesPage />,
  },
  {
    path: "/fruechte-gemuese",
    title: "Früchte & Gemüse",
    subtitle: "Die Rohstoffe für die Saftherstellung",
    element: <ProducePage />,
  },
  {
    path: "/samen",
    title: "Samen",
    subtitle: "Saatgut für Kohl, Ananas, Mandarinen und Kürbis",
    element: <SeedsPage />,
  },
];

export function App() {
  return (
    <div className="flex h-full">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Routes>
          {PAGES.map((page) => (
            <Route
              key={page.path}
              path={page.path}
              element={
                <>
                  <TopBar title={page.title} subtitle={page.subtitle} />
                  {page.element}
                </>
              }
            />
          ))}
          <Route path="*" element={<Navigate to="/juices" replace />} />
        </Routes>
      </div>
    </div>
  );
}
