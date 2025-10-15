import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import '@/index.css'
import { HomePage } from '@/pages/HomePage'
import { GamePage } from '@/pages/GamePage';
import { Layout } from '@/components/Layout';
import { MatchmakingLobbyPage } from '@/pages/MatchmakingLobbyPage';
import { PlayerProfilePage } from '@/pages/PlayerProfilePage';
import { LoginPage } from '@/pages/LoginPage';
const router = createBrowserRouter([
  {
    path: "/",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    element: <Layout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "/dashboard",
        element: <HomePage />,
      },
      {
        path: "/game/:gameId",
        element: <GamePage />,
      },
      {
        path: "/lobby",
        element: <MatchmakingLobbyPage />,
      },
      {
        path: "/profile/:playerId",
        element: <PlayerProfilePage />,
      },
    ]
  }
]);
// Do not touch this code
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
)