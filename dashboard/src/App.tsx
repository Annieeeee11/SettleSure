import { Route, Routes } from "react-router-dom";
import DashboardRoute from "./pages/DashboardRoute";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<DashboardRoute />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
