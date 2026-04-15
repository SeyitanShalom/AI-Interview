"use client";
import { motion } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-28 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl glow-border bg-linear-to-br from-primary/8 via-card/80 to-card p-12 md:p-20 text-center overflow-hidden"
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
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Get Started Today
              </span>
            </motion.div>

            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-tight">
              Ready to Land Your
              <br />
              <span className="text-gradient-primary">Dream Job?</span>
            </h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto mb-10 leading-relaxed">
              Join thousands of candidates and companies already using
              InterviewAI to transform their hiring process.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/candidate/auth">
                <Button
                  size="lg"
                  className="group text-base px-8 py-6 font-semibold bg-linear-to-r from-primary to-primary-glow hover:opacity-90 transition-all shadow-(--shadow-glow)"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
              <a href="/company/auth">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base px-8 py-6 font-semibold border-border/60 hover:bg-secondary/60 hover:border-border transition-all"
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
