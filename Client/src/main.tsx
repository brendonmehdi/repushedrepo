import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainPage from "./components/main/MainPage.tsx";
import LoginPage from "./components/login/LoginPage.tsx";
import { AuthProvider, useAuth } from "./context/AuthContext.tsx";

function AppRouter() {
  const [showLogin, setShowLogin] = useState(false);
  const { user } = useAuth();

  // If user requests login page
  if (showLogin && !user) {
    return <LoginPage onLoginSuccess={() => setShowLogin(false)} />;
  }

  // Main page with login redirect callback
  return <MainPage onLoginRequest={() => setShowLogin(true)} />;
}

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
