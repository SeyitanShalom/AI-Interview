"use client";
import { Button } from "@/app/components/ui/button";
import { Video, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-5 left-20 right-20 z-50 border-b border-border/40 bg-primary/20 backdrop-blur-2xl rounded-2xl">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center ">
            <Video className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            InterviewAI
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-foreground">
          <a
            href="/candidates"
            className="hover:scale-110 transition-all duration-200 text-base"
          >
            For Candidates
          </a>
          <a
            href="/companies"
            className="hover:scale-110 transition-all duration-200 text-base"
          >
            For Companies
          </a>
          <a
            href="/pricing"
            className="hover:scale-110 transition-all duration-200 text-base"
          >
            Pricing
          </a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a href="/candidate/auth">
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground hover:text-foreground font-medium text-base"
            >
              Log In
            </Button>
          </a>
          <a href="/company/auth">
            <Button
              size="sm"
              className="font-semibold bg-primary hover:opacity-90 transition-opacity text-base"
            >
              For Companies
            </Button>
          </a>
        </div>

        {/* Mobile menu button */}
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

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-2xl overflow-hidden"
          >
            <div className="container mx-auto px-6 py-6 flex flex-col gap-4">
              <a
                href="/candidates"
                className="text-sm font-medium text-primary hover:text-foreground py-2"
              >
                For Candidates
              </a>
              <a
                href="/companies"
                className="text-sm font-medium text-muted-foreground hover:text-foreground py-2"
              >
                For Companies
              </a>
              <a
                href="/pricing"
                className="text-sm font-medium text-muted-foreground hover:text-foreground py-2"
              >
                Pricing
              </a>
              <div className="flex gap-3 pt-2">
                <a href="/candidate/auth">
                  <Button variant="outline" size="sm">
                    Log In
                  </Button>
                </a>
                <a href="/company/auth">
                  <Button
                    size="sm"
                    className="bg-primary hover:opacity-90 transition-opacity"
                  >
                    For Companies
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
