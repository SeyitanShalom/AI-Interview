"use client";

import { motion } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import { Video, ArrowRight, Sparkles, Play } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Layered background effects */}
      <div className="absolute inset-0 bg-(--gradient-hero)" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(160_84%_39%/0.2)_0%,transparent_70%)]" />
      {/* <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-125 rounded-full bg-primary/5 blur-[150px] animate-pulse-glow" /> */}
      {/* <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" /> */}

      {/* Dot grid pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(hsl(160_84%_39%/0.1)_1px,transparent_1px)] bg-size-[32px_32px] `mask-[radial-gradient(ellipse_at_center,black_20%,transparent_60%)]` `mask-[radial-gradient(ellipse_at_center,black_20%,transparent_60%)]`" />

      <div className="relative z-10 container mx-auto px-6 text-center ">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full glow-border bg-primary/5 mb-10"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-semibold tracking-wide uppercase text-primary">
            AI-Powered Interview Platform
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[0.92] mb-7"
        >
          Ace Every
          <br />
          <span className="text-gradient-primary">Interview</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="max-w-xl mx-auto text-base md:text-lg text-muted-foreground mb-12 leading-relaxed"
        >
          Practice with AI interviewers, get real-time feedback on your answers,
          and let companies run structured video interviews — all in one
          platform.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-20"
        >
          <a href="/candidate/auth">
            <Button
              size="lg"
              className="text-base px-8 py-6 font-semibold  bg-primary hover:opacity-90 transition-all  "
            >
              <Video className="w-5 h-5 mr-1 translate-y-[1px]" />
              Start Practicing Free
              <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1 translate-y-[1px]" />
            </Button>
          </a>
          <a href="/company/auth">
            <Button
              variant="outline"
              size="lg"
              className="text-base px-8 py-6 font-semibold border-border/60 hover:bg-secondary/60 hover:border-border transition-all translate-y-[1px]"
            >
              <Play className="w-4 h-4 mr-1" />
              For Companies
            </Button>
          </a>
        </motion.div>

        {/* Stats */}
        {/* <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65 }}
          className="mt-24 grid grid-cols-3 max-w-lg mx-auto"
        >
          {[
            { value: "50K+", label: "Interviews" },
            { value: "92%", label: "Success Rate" },
            { value: "300+", label: "Companies" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center py-4 ${i !== 2 ? "border-r border-border/40" : ""}`}
            >
              <div className="font-display text-2xl md:text-3xl font-extrabold text-gradient-primary">
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1.5 font-medium tracking-wide">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div> */}
      </div>
    </section>
  );
};

export default Hero;
