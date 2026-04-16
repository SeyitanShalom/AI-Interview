"use client";
import { motion } from "framer-motion";
import { Button } from "@/app/components/ui/button";
import { Check, Sparkles, Building2, User } from "lucide-react";
import Navbar from "@/app/components/landing/Navbar";
import Footer from "@/app/components/landing/Footer";

const candidatePlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Get started with basic interview practice.",
    features: [
      "3 AI mock interviews per month",
      "Basic feedback on answers",
      "General question bank",
      "Video recording & playback",
    ],
    cta: "Get Started Free",
    href: "/candidate/auth",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    desc: "Unlimited practice with advanced AI coaching.",
    features: [
      "Unlimited AI mock interviews",
      "Detailed feedback with scoring",
      "Role-specific question banks",
      "Progress analytics & trends",
      "Body language analysis",
      "Priority AI processing",
    ],
    cta: "Upgrade to Pro",
    href: "/candidate/auth",
    highlighted: true,
  },
];

const companyPlans = [
  {
    name: "Team",
    price: "$99",
    period: "/month",
    desc: "For small hiring teams getting started.",
    features: [
      "Up to 10 team members",
      "50 candidate interviews/month",
      "Custom interview kits",
      "Invite code system",
      "AI-scored evaluations",
      "Basic analytics",
    ],
    cta: "Start with Team",
    href: "/company/auth",
    highlighted: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For large organizations with advanced needs.",
    features: [
      "Unlimited team members",
      "Unlimited interviews",
      "Custom interview kits & rubrics",
      "Advanced analytics & reporting",
      "SSO & SAML integration",
      "Dedicated account manager",
      "API access",
      "Custom branding",
    ],
    cta: "Contact Sales",
    href: "/company/auth",
    highlighted: true,
  },
];

interface PlanCardProps {
  plan: {
    name: string;
    price: string;
    period: string;
    desc: string;
    features: string[];
    cta: string;
    href: string;
    highlighted: boolean;
  };
  index: number;
}

const PlanCard = ({ plan, index }: PlanCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1 }}
    className={`relative rounded-xl border p-8 flex flex-col ${
      plan.highlighted
        ? "border-primary/50 bg-card/80 shadow-[var(--shadow-glow)]"
        : "border-border/50 bg-card/50"
    }`}
  >
    {plan.highlighted && (
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        Most Popular
      </div>
    )}
    <h3 className="font-display text-xl font-bold mb-1">{plan.name}</h3>
    <div className="flex items-baseline gap-1 mb-2">
      <span className="font-display text-4xl font-extrabold">{plan.price}</span>
      {plan.period && (
        <span className="text-muted-foreground text-sm">{plan.period}</span>
      )}
    </div>
    <p className="text-sm text-muted-foreground mb-6">{plan.desc}</p>

    <ul className="space-y-3 mb-8 flex-1">
      {plan.features.map((f) => (
        <li key={f} className="flex items-start gap-2 text-sm">
          <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <span>{f}</span>
        </li>
      ))}
    </ul>

    <a href={plan.href}>
      <Button
        className="w-full font-semibold"
        variant={plan.highlighted ? "default" : "outline"}
        size="lg"
      >
        {plan.cta}
      </Button>
    </a>
  </motion.div>
);

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(160_84%_39%/0.08)_0%,transparent_60%)]" />
        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-6"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Pricing</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-4xl md:text-6xl font-extrabold tracking-tight leading-[0.95] mb-6"
          >
            Simple, transparent{" "}
            <span className="text-gradient-primary bg-clip-text text-transparent">
              pricing
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-xl mx-auto text-lg text-muted-foreground"
          >
            Whether you're a candidate leveling up or a company scaling hiring —
            pick the plan that fits.
          </motion.p>
        </div>
      </section>

      {/* Candidate Plans */}
      <section className="py-16 border-t border-border/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-3 mb-10"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold">
                For Candidates
              </h2>
              <p className="text-sm text-muted-foreground">
                Practice and ace your interviews
              </p>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
            {candidatePlans.map((plan, i) => (
              <PlanCard key={plan.name} plan={plan} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Company Plans */}
      <section className="py-16 border-t border-border/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-3 mb-10"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold">For Companies</h2>
              <p className="text-sm text-muted-foreground">
                Scale your interview process with AI
              </p>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
            {companyPlans.map((plan, i) => (
              <PlanCard key={plan.name} plan={plan} index={i} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;
