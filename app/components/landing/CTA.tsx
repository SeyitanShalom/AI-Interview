"use client";
import { motion } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";

const CTA = () => {
  return (
    <section className="relative py-28">
      <div className="container px-6 mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative p-12 overflow-hidden text-center rounded-3xl glow-border bg-linear-to-br from-primary/8 via-card/80 to-card md:p-20"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/8 rounded-full blur-[120px] animate-pulse-glow" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-primary-glow/5 rounded-full blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(hsl(160_84%_39%/0.04)_1px,transparent_1px)] bg-size-[24px_24px]" />

          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
            >
              <div className="w-10 h-[.8px] md:h-px bg-primary"></div>

              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold tracking-wide uppercase text-[10px] md:text-xs text-primary">
                Get Started Today
              </span>
              <div className="w-10 h-[.8px] md:h-px bg-primary"></div>
            </motion.div>

            <h2 className="mb-5 text-4xl leading-tight font-display md:text-5xl lg:text-6xl">
              Ready to Land Your
              <br />
              <span className="text-gradient-primary">Dream Job?</span>
            </h2>
            <p className="max-w-lg mx-auto mb-10 text-sm leading-relaxed md:text-base text-muted-foreground">
              Join thousands of candidates and companies already using
              InterviewAI to transform their hiring process.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="/candidate/auth">
                <Button
                  size="lg"
                  className="group text-sm md:text-base px-8 py-6 font-semibold bg-linear-to-r from-primary to-primary-glow hover:opacity-90 transition-all shadow-(--shadow-glow)"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
              <a href="/company/auth">
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8 py-6 text-sm font-semibold transition-all md:text-base border-border/60 hover:bg-secondary/60 hover:border-border"
                >
                  Book a Demo
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
