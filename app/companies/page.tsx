"use client";
import { motion } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import {
  ArrowRight,
  Building2,
  Users,
  ClipboardList,
  BarChart3,
  Link2,
  ShieldCheck,
} from "lucide-react";
// import Navbar from "@/app/components/landing/Navbar";
import Footer from "@/app/components/landing/Footer";

const features = [
  {
    icon: ClipboardList,
    title: "Structured Interview Kits",
    desc: "Create standardized question sets for each role so every candidate gets a fair, consistent evaluation.",
  },
  {
    icon: Link2,
    title: "Invite Code System",
    desc: "Generate unique invite codes to onboard hiring managers and recruiters onto your company workspace securely.",
  },
  {
    icon: Users,
    title: "Team Management",
    desc: "Add team members, assign roles, and collaborate on candidate evaluations — all from one dashboard.",
  },
  {
    icon: BarChart3,
    title: "Candidate Analytics",
    desc: "Compare candidates side-by-side with AI-scored responses, confidence metrics, and structured rubrics.",
  },
  {
    icon: Building2,
    title: "Company Branding",
    desc: "Customize your interview experience with your logo and brand colours so candidates feel at home.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance & Privacy",
    desc: "Enterprise-grade security with role-based access controls, audit logs, and GDPR-ready data handling.",
  },
];

const steps = [
  {
    num: "01",
    title: "Register Your Company",
    desc: "Create a company account and set up your workspace.",
  },
  {
    num: "02",
    title: "Invite Your Team",
    desc: "Share your unique invite code with hiring managers.",
  },
  {
    num: "03",
    title: "Create Interview Kits",
    desc: "Build question sets tailored to each open role.",
  },
  {
    num: "04",
    title: "Evaluate Candidates",
    desc: "Review AI-scored video responses and hire with confidence.",
  },
];

const ForCompanies = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* <Navbar /> */}

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(160_84%_39%/0.08)_0%,transparent_60%)]" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-125 h-125 rounded-full bg-primary/5 blur-[120px]" />

        <div className="container relative z-10 px-6 mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-6"
          >
          <div className="w-12 h-[.8px] md:h-px bg-primary"></div>
            
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              For Companies
            </span>
          <div className="w-12 h-[.8px] md:h-px bg-primary"></div>

          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-5xl md:text-6xl lg:text-7xl  tracking-tight leading-[0.95] mb-6"
          >
            Hire Smarter
            <br />
            <span className="text-transparent text-gradient-primary bg-clip-text">
              with AI
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl mx-auto mb-10 text-sm leading-relaxed md:text-lg text-muted-foreground"
          >
            Run structured, AI-assisted video interviews at scale. Evaluate
            candidates consistently, collaborate with your team, and make
            data-driven hiring decisions.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <a href="/company/auth">
              <Button
                size="lg"
                className="group text-sm md:text-base px-8 py-6 font-semibold shadow-[var(--shadow-glow)]"
              >
                Get Started for Your Team
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 border-t border-border/30">
        <div className="container px-6 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-display md:text-4xl">
              Built for <span className="text-gradient-primary">hiring teams</span>
            </h2>
            <p className="max-w-xl mx-auto text-sm md:text-base text-muted-foreground">
              Everything your team needs to run a modern, structured interview
              process.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-6 transition-all duration-300 border group rounded-xl border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card/80"
              >
                <div className="flex items-center justify-center w-10 h-10 mb-4 transition-colors rounded-lg bg-primary/10 group-hover:bg-primary/20">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold font-display">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-t border-border/30">
        <div className="container px-6 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-display md:text-4xl">
              How it <span className="text-gradient-primary">works</span>
            </h2>
            <p className="max-w-xl mx-auto text-sm md:text-base text-muted-foreground">
              Get your team up and running in minutes, not weeks.
            </p>
          </motion.div>

          <div className="grid max-w-4xl gap-8 mx-auto md:grid-cols-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="mb-3 text-4xl font-extrabold font-display text-primary/20">
                  {step.num}
                </div>
                <h3 className="mb-2 font-semibold font-display">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border/30">
        <div className="container px-6 mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative p-12 overflow-hidden text-center border rounded-2xl border-primary/20 bg-linear-to-br from-primary/10 to-transparent"
          >
           <div className="absolute top-0 right-0 w-80 h-80 bg-primary/8 rounded-full blur-[120px] animate-pulse-glow" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-primary-glow/5 rounded-full blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(hsl(160_84%_39%/0.04)_1px,transparent_1px)] bg-size-[24px_24px]" />
            <div className="relative z-10">
              <Building2 className="w-10 h-10 mx-auto mb-4 text-primary" />
              <h2 className="mb-4 text-3xl font-display md:text-4xl">
                Ready to transform your hiring?
              </h2>
              <p className="max-w-lg mx-auto mb-8 text-sm md:text-base text-muted-foreground">
                Join 300+ companies using AI-powered interviews to find the best
                talent faster.
              </p>
              <a href="/company/auth">
                <Button
                  size="lg"
                  className="group text-base px-8 py-6 font-semibold shadow-(--shadow-glow)"
                >
                  Start Hiring Smarter
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* <Footer /> */}
    </div>
  );
};

export default ForCompanies;
