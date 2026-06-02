"use client";

import { Button } from "@/app/components/ui/button";
import { Video, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

const marketingLinks = [
  { href: "/", label: "Home" },
  { href: "/candidates", label: "For Candidates" },
  { href: "/companies", label: "For Companies" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const role =
    typeof user?.user_metadata?.role === "string"
      ? user.user_metadata.role
      : null;
  const isCandidateApp =
    pathname?.startsWith("/candidate/dashboard") ||
    pathname?.startsWith("/candidate/profile");
  const isCompanyApp = pathname?.startsWith("/company/dashboard");
  const isAppArea = isCandidateApp || isCompanyApp;
  const navLinks = isAppArea ? [] : marketingLinks;
  const logoHref = isCandidateApp
    ? "/candidate/dashboard"
    : isCompanyApp
      ? "/company/dashboard"
      : "/";
  const dashboardHref =
    role === "company" ? "/company/dashboard" : "/candidate/dashboard";

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      setMobileOpen(false);
      router.replace("/");
      router.refresh();
    }
  };

  return (
    <nav className="fixed left-0 right-0 z-50 border-b top-2 md:left-10 md:right-10 border-border/40 dark:bg-primary/5 backdrop-blur-2xl rounded-2xl">
      <div className="container flex items-center justify-between h-16 px-6 mx-auto">
        <Link href={logoHref} className="flex items-center gap-2.5 group">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary ">
            <Video className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight font-display">
            InterviewAI
          </span>
        </Link>

        <div className="items-center hidden gap-8 font-medium md:flex text-foreground">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm transition-all duration-200 hover:scale-110"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="items-center hidden gap-3 md:flex">
          {isAppArea && user ? (
            <>
              <span className="text-sm truncate max-w-52 text-muted-foreground">
                {user.email}
              </span>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="gap-2 text-sm font-medium text-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              {user && role ? (
                <Link href={dashboardHref}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-sm font-medium text-foreground hover:text-foreground"
                  >
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <Link href="/candidate/auth">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-sm font-medium text-foreground hover:text-foreground"
                  >
                    Log In
                  </Button>
                </Link>
              )}
              <Link href="/company/auth">
                <Button
                  size="lg"
                  className="text-sm font-semibold transition-opacity bg-primary hover:opacity-80"
                >
                  For Companies
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t md:hidden border-border/40 bg-background/95 backdrop-blur-2xl"
          >
            <div className="container flex flex-col gap-4 px-6 py-6 mx-auto">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="py-2 text-sm font-medium sm:text-base text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}

              <div className="flex gap-3 pt-2">
                {isAppArea && user ? (
                  <div className="flex flex-col w-full gap-3">
                    <span className="text-sm truncate text-muted-foreground">
                      {user.email}
                    </span>
                    <Button
                      onClick={handleSignOut}
                      variant="outline"
                      size="sm"
                      className="self-start gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <>
                    {user && role ? (
                      <Link href={dashboardHref}>
                        <Button variant="outline" size="sm">
                          Dashboard
                        </Button>
                      </Link>
                    ) : (
                      <Link href="/candidate/auth">
                        <Button variant="outline" size="sm">
                          Log In
                        </Button>
                      </Link>
                    )}
                    <Link href="/company/auth">
                      <Button
                        size="sm"
                        className="transition-opacity bg-primary hover:opacity-90"
                      >
                        For Companies
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
