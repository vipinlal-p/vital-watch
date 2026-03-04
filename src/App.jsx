import React from "react";
import {
  BrowserRouter as Router,
  useLocation,
} from "react-router-dom";
import Home from "./pages/Home";
import Help from "./pages/Help";
import Admin from "./pages/Admin";

function ScrollToTop() {
  const location = useLocation();

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return null;
}

function AppRoutes() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();

  let page = <Home />;
  if (path === "/help") page = <Help />;
  if (path === "/admin") page = <Admin />;

  return (
    <main className="flex-grow" key={location.pathname}>
      {page}
    </main>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen">
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;
