import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { LobbyPage } from "./pages/LobbyPage";
import { LoginPage } from "./pages/LoginPage";
import { RoomPage } from "./pages/RoomPage";
import { SettingsPage } from "./pages/SettingsPage";

function RoomRedirect() {
  const id = sessionStorage.getItem("lnvoice_currentRoomId");
  if (id) return <Navigate to={`/room/${id}`} replace />;
  return <Navigate to="/lobby" replace />;
}

function AppRoutes() {
  const { userId } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route
          path="/lobby"
          element={userId ? <LobbyPage /> : <Navigate to="/login" replace />}
        />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/room" element={<RoomRedirect />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={userId ? "/lobby" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
