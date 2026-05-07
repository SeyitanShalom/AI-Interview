"use client";

import { Button } from "@/app/components/ui/button";
import { Video, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isDashboard =
    pathname?.startsWith("/candidate/dashboard") ||
    pathname?.startsWith("/company/dashboard");

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    router.replace("/");
    router.refresh();
  };

  return (
    <nav className="fixed left-0 right-0 z-50 border-b top-2 md:left-10 md:right-10 border-border/40 dark:bg-primary/5 backdrop-blur-2xl rounded-2xl">
      <div className="container flex items-center justify-between h-16 px-6 mx-auto">
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary ">
            <Video className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight font-display">
            InterviewAI
          </span>
        </a>

        <div className="items-center hidden gap-8 font-medium md:flex text-foreground">
          <a
            href="/"
            className="text-sm transition-all duration-200 hover:scale-110"
          >
            Home
          </a>
          <a
            href="/candidates"
            className="text-sm transition-all duration-200 hover:scale-110"
          >
            For Candidates
          </a>
          <a
            href="/companies"
            className="text-sm transition-all duration-200 hover:scale-110"
          >
            For Companies
          </a>
          {/* <a
            href="/pricing"
            className="text-sm transition-all duration-200 hover:scale-110"
          >
            Pricing
          </a> */}
        </div>

        <div className="items-center hidden gap-3 md:flex">
          {isDashboard ? (
            <Button
              onClick={handleSignOut}
              variant="ghost"
              size="sm"
              className="text-sm font-medium text-foreground hover:text-foreground"
            >
              Sign Out
            </Button>
          ) : (
            <>
              <a href="/candidate/auth">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm font-medium text-foreground hover:text-foreground"
                >
                  Log In
                </Button>
              </a>
              <a href="/company/auth">
                <Button
                  size="lg"
                  className="text-sm font-semibold transition-opacity bg-primary hover:opacity-80"
                >
                  For Companies
                </Button>
              </a>
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
              <a
                href="/"
                className="py-2 text-sm font-medium sm:text-base text-muted-foreground hover:text-foreground"
              >
                Home
              </a>
              <a
                href="/candidates"
                className="py-2 text-sm font-medium sm:text-base text-muted-foreground hover:text-foreground"
              >
                For Candidates
              </a>
              <a
                href="/companies"
                className="py-2 text-sm font-medium sm:text-base text-muted-foreground hover:text-foreground"
              >
                For Companies
              </a>
              {/* <a
                href="/pricing"
                className="py-2 text-sm font-medium sm:text-base text-muted-foreground hover:text-foreground"
              >
                Pricing
              </a> */}

              <div className="flex gap-3 pt-2">
                {isDashboard ? (
                  <Button onClick={handleSignOut} variant="outline" size="sm">
                    Sign Out
                  </Button>
                ) : (
                  <>
                    <a href="/candidate/auth">
                      <Button variant="outline" size="sm">
                        Log In
                      </Button>
                    </a>
                    <a href="/company/auth">
                      <Button
                        size="sm"
                        className="transition-opacity bg-primary hover:opacity-90"
                      >
                        For Companies
                      </Button>
                    </a>
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
