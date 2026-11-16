import { ArrowRight, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Buildings } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BrandLockup from "../../components/navigation/BrandLockup.jsx";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import { useAuth } from "../../context/use-auth.js";
import api from "../../lib/api.js";
import { getDashboardOptions } from "../../services/dashboard-access.js";

function PublicLayout({ children }) {
  const { loading: authLoading, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const { data: profileResponse, isPending: profileLoading } = useQuery({
    queryKey: ["auth", "me", user?.uid],
    queryFn: async () => (await api.get("/auth/me")).data,
    enabled: Boolean(user) && !authLoading,
    retry: false,
  });

  const dashboardOptions = getDashboardOptions(profileResponse?.data);
  const dashboardPath =
    dashboardOptions.length === 1 ? dashboardOptions[0].path : "/dashboard";
  const showAuthActions = !authLoading && (!user || !profileLoading);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    function handlePointerDown(event) {
      if (
        !mobileMenuRef.current?.contains(event.target) &&
        !mobileMenuButtonRef.current?.contains(event.target)
      ) {
        setMobileMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      toast.success("Signed out");
      if (location.pathname !== "/") {
        navigate("/", { replace: true });
      }
    } catch (error) {
      toast.error(error.message || "Unable to sign out");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="public-layout">
      <header className="public-header">
        <BrandLockup
          ariaLabel="Issue Ache home"
          icon={Buildings}
          iconSize={21}
          iconWeight="duotone"
        />
        <nav
          aria-label="Main navigation"
          className={`public-nav${mobileMenuOpen ? " is-open" : ""}`}
          id="public-navigation"
          ref={mobileMenuRef}
        >
          <Link
            className="public-nav-link"
            onClick={() => setMobileMenuOpen(false)}
            to="/about"
          >
            About
          </Link>
          <Link
            className="public-nav-link"
            onClick={() => setMobileMenuOpen(false)}
            to="/how-it-works"
          >
            How It Works
          </Link>
          <Link
            className="public-nav-link"
            onClick={() => setMobileMenuOpen(false)}
            to="/pricing"
          >
            Pricing
          </Link>
        </nav>
        <div className="public-nav-actions">
          {showAuthActions &&
            (user ? (
              <>
                <Link className="public-login-link" to={dashboardPath}>
                  <LayoutDashboard aria-hidden="true" size={16} />
                  Dashboard
                </Link>
                <button
                  className="public-signout-button"
                  disabled={signingOut}
                  onClick={handleSignOut}
                  type="button"
                >
                  <LogOut aria-hidden="true" size={16} />
                  {signingOut ? "Signing out…" : "Sign Out"}
                </button>
              </>
            ) : (
              <>
                <Link className="public-login-link" to="/login">Sign In</Link>
                <Link className="public-login-link" to="/pricing">
                  Get started <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </>
            ))}
          <ThemeToggle />
          <button
            aria-controls="public-navigation"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            className="icon-button public-menu-button"
            onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
            ref={mobileMenuButtonRef}
            type="button"
          >
            {mobileMenuOpen ? (
              <X aria-hidden="true" size={19} />
            ) : (
              <Menu aria-hidden="true" size={19} />
            )}
          </button>
        </div>
      </header>
      <div className="public-content">{children}</div>
    </div>
  );
}

export default PublicLayout;
