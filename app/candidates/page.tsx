"use client";
import { motion } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import {
  Video,
  ArrowRight,
  Brain,
  BarChart3,
  MessageSquare,
  Target,
  Clock,
  Shield,
} from "lucide-react";
import Navbar from "@/app/components/landing/Navbar";
import Footer from "@/app/components/landing/Footer";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Mock Interviews",
    desc: "Practice with an intelligent AI interviewer that adapts questions based on your role, experience level, and target company.",
  },
  {
    icon: Video,
    title: "Video Recording & Playback",
    desc: "Record your responses and review them to improve body language, pacing, and delivery before the real thing.",
  },
  {
    icon: MessageSquare,
    title: "Real-Time Feedback",
    desc: "Get instant AI analysis on your answers — covering clarity, relevance, structure, and confidence.",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    desc: "Watch your interview skills improve over time with detailed analytics and performance scores.",
  },
  {
    icon: Target,
    title: "Role-Specific Questions",
    desc: "Practice with curated question banks for software engineering, product, design, data science, and more.",
  },
  {
    icon: Clock,
    title: "Practice Anytime",
    desc: "No scheduling required. Jump into a practice session whenever you're ready — 24/7 availability.",
  },
];

const steps = [
  {
    num: "01",
    title: "Sign Up Free",
    desc: "Create your candidate account in seconds.",
  },
  {
    num: "02",
    title: "Pick Your Role",
    desc: "Choose the job role and difficulty level you want to practice.",
  },
  {
    num: "03",
    title: "Start Practicing",
    desc: "Begin an AI-powered mock interview with video recording.",
  },
  {
    num: "04",
    title: "Get Feedback",
    desc: "Review AI-generated feedback and improve for your real interview.",
  },
];

const ForCandidates = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(160_84%_39%/0.08)_0%,_transparent_60%)]" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />

        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-6"
          >
            <Video className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              For Candidates
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[0.95] mb-6"
          >
            Your AI
            <br />
            <span className="text-gradient-primary bg-clip-text text-transparent">
              Interview Coach
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl mx-auto text-lg text-muted-foreground mb-10 leading-relaxed"
          >
            Practice realistic mock interviews with AI, get actionable feedback
            on every answer, and walk into your next interview with unshakeable
            confidence.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <a href="/candidate/auth">
              <Button
                size="lg"
                className="group text-base px-8 py-6 font-semibold shadow-[var(--shadow-glow)]"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Everything you need to{" "}
              <span className="text-gradient-primary">prepare</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A complete toolkit designed to make your interview preparation
              efficient and effective.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group rounded-xl border border-border/50 bg-card/50 p-6 hover:border-primary/30 hover:bg-card/80 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              How it <span className="text-gradient-primary">works</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From sign-up to interview-ready in four simple steps.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="font-display text-4xl font-extrabold text-primary/20 mb-3">
                  {step.num}
                </div>
                <h3 className="font-display font-semibold mb-2">
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
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-2xl border border-primary/20 bg-linear-to-br from-primary/10 to-transparent p-12 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(160_84%_39%/0.06)_0%,transparent_70%)]" />
            <div className="relative z-10">
              <Shield className="w-10 h-10 text-primary mx-auto mb-4" />
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Ready to ace your next interview?
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto mb-8">
                Join thousands of candidates who landed their dream jobs with
                AI-powered preparation.
              </p>
              <a href="/candidate/auth">
                <Button
                  size="lg"
                  className="group text-base px-8 py-6 font-semibold shadow-(--shadow-glow)"
                >
                  Start Practicing Now
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ForCandidates;
