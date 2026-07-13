"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Video } from "lucide-react";

const DISPLAY_MS = 3200;
const BRAND_NAME = "InterviewAI";
const letters = BRAND_NAME.split("");

const wordVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.9,
      staggerChildren: 0.085,
    },
  },
};

const letterVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 34,
    rotateX: -72,
    filter: "blur(10px)",
  },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.54,
      ease: [0.2, 0.8, 0.2, 1],
    },
  },
};

export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, DISPLAY_MS);

    return () => window.clearTimeout(hideTimer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[100] overflow-hidden bg-background text-foreground"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
        >
          <motion.div
            className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
            initial={{ scale: 0.65, opacity: 0 }}
            animate={{ scale: [0.65, 1.08, 0.92], opacity: [0, 0.9, 0.65] }}
            transition={{ duration: 2.6, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-primary/12 blur-3xl"
            animate={{ x: [0, 80, 20], y: [0, -30, 20], opacity: [0.45, 0.85, 0.5] }}
            transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity }}
          />
          <motion.div
            className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
            animate={{ x: [0, -70, -10], y: [0, 35, -20], opacity: [0.35, 0.8, 0.45] }}
            transition={{
              duration: 3.4,
              ease: "easeInOut",
              repeat: Infinity,
              delay: 0.25,
            }}
          />
          <motion.div
            className="absolute inset-0 splash-sheen"
            initial={{ x: "-140%", opacity: 0 }}
            animate={{ x: "140%", opacity: [0, 0.7, 0] }}
            transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
          />

          <div className="relative flex min-h-screen items-center justify-center px-6">
            <motion.div
              className="flex flex-col items-center text-center"
              initial="hidden"
              animate="show"
            >
              <div className="relative mb-9 flex h-36 w-36 items-center justify-center md:h-40 md:w-40">
                <motion.div
                  className="absolute inset-0 rounded-[2.25rem] border border-primary/20"
                  initial={{ opacity: 0, scale: 0.65, rotate: -22 }}
                  animate={{
                    opacity: [0, 0.85, 0.35],
                    scale: [0.65, 1.18, 1],
                    rotate: 0,
                  }}
                  transition={{ duration: 1.35, ease: "easeOut", delay: 0.22 }}
                />
                <motion.div
                  className="absolute inset-5 rounded-[1.6rem] border border-primary/25"
                  initial={{ opacity: 0, scale: 0.75, rotate: 24 }}
                  animate={{
                    opacity: [0, 0.9, 0.45],
                    scale: [0.75, 1.12, 1],
                    rotate: 0,
                  }}
                  transition={{ duration: 1.25, ease: "easeOut", delay: 0.34 }}
                />

                <motion.div
                  className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-primary shadow-[0_24px_90px_-28px_var(--primary)]"
                  initial={{
                    opacity: 0,
                    x: -220,
                    y: 22,
                    rotate: -360,
                    scale: 0.25,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    y: 0,
                    rotate: 0,
                    scale: 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 130,
                    damping: 12,
                    mass: 0.85,
                    delay: 0.2,
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.34, ease: "easeOut", delay: 0.65 }}
                  >
                    <Video className="h-10 w-10 text-primary-foreground" />
                  </motion.div>
                </motion.div>
              </div>

              <motion.h1
                className="font-display text-4xl font-bold tracking-normal md:text-6xl"
                variants={wordVariants}
              >
                {letters.map((letter, index) => (
                  <motion.span
                    key={`${letter}-${index}`}
                    className="inline-block [transform-style:preserve-3d]"
                    variants={letterVariants}
                  >
                    {letter}
                  </motion.span>
                ))}
              </motion.h1>

              <motion.div
                className="mt-5 flex items-center gap-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 1.95 }}
              >
                <span className="h-px w-10 bg-primary/45" />
                <span className="font-display text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                  AI Interview Studio
                </span>
                <span className="h-px w-10 bg-primary/45" />
              </motion.div>

              <motion.div
                className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-primary/12"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, ease: "easeOut", delay: 2.08 }}
              >
                <motion.div
                  className="h-full w-1/2 rounded-full bg-primary"
                  animate={{ x: ["-120%", "240%"] }}
                  transition={{
                    duration: 1.05,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }}
                />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
