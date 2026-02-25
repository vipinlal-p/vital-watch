import React from "react";
import {
  BrowserRouter as Router,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Services from "./pages/Services";
import Contact from "./pages/Contact";
import News from "./pages/News";

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
  if (path === "/services" || path === "/service") page = <Services />;
  else if (path === "/contact") page = <Contact />;
  else if (path === "/news") page = <News />;

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
        <Navbar />
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;
