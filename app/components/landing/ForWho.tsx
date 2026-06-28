"use client";
import type { ComponentType } from "react";
import { motion } from "framer-motion";
import {
  UserCheck,
  Building2,
  Video,
  Brain,
  BarChart3,
  Users,
  ClipboardList,
  Calendar,
} from "lucide-react";

const candidateFeatures = [
  {
    icon: Video,
    title: "Video Practice",
    desc: "Record yourself answering real interview questions",
  },
  {
    icon: Brain,
    title: "AI Feedback",
    desc: "Get instant analysis on your tone, pace, and content",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    desc: "See improvement over time with detailed analytics",
  },
  {
    icon: UserCheck,
    title: "Mock Interviews",
    desc: "Simulate real interviews with AI interviewers",
  },
];

const companyFeatures = [
  {
    icon: ClipboardList,
    title: "Custom Questions",
    desc: "Create tailored question sets for each role",
  },
  {
    icon: Calendar,
    title: "Async Interviews",
    desc: "Candidates record on their own schedule",
  },
  {
    icon: Users,
    title: "Team Review",
    desc: "Collaborate with your hiring team on evaluations",
  },
  {
    icon: BarChart3,
    title: "AI Scoring",
    desc: "Automated scoring with detailed candidate insights",
  },
];

const FeatureCard = ({
  icon: Icon,
  title,
  desc,
  index,
}: {
  icon: ComponentType<{ className: string }>;
  title: string;
  desc: string;
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.08, duration: 0.4 }}
    className="flex items-center gap-4 p-4 transition-all duration-300 rounded-xl hover:bg-primary/5 group"
  >
    <div className="flex items-center justify-center w-10 h-10 transition-colors rounded-lg shrink-0 bg-primary/10 group-hover:bg-primary/15">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div>
      <h4 className="text-base font-semibold text-foreground">
        {title}
      </h4>
      <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
        {desc}
      </p>
    </div>
  </motion.div>
);

const ForWho = () => {
  return (
    <section className="relative py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(183_100%_32%/0.04)_0%,transparent_50%)]" />
      <div className="container relative z-10 px-6 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <span className="block mb-3 text-xs font-semibold tracking-widest uppercase text-primary">
            Who It&apos;s For
          </span>
          <h2 className="mb-4 text-4xl font-display md:text-5xl">
            Built for <span className="text-gradient-primary">Everyone</span>
          </h2>
          <p className="max-w-xl mx-auto md:text-lg text-muted-foreground">
            Whether you&apos;re preparing for your dream job or hiring the best
            talent.
          </p>
        </motion.div>

        <div className="grid max-w-5xl gap-6 mx-auto md:grid-cols-2">
          {/* Candidates */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-8 rounded-2xl glass-card"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-linear-to-br from-primary/30 to-primary/5">
                <UserCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-display">
                  For Candidates
                </h3>
                <p className="text-xs font-medium text-muted-foreground">
                  Practice & improve
                </p>
              </div>
            </div>
            <div className="space-y-1">
              {candidateFeatures.map((f, i) => (
                <FeatureCard key={f.title} {...f} index={i} />
              ))}
            </div>
          </motion.div>

          {/* Companies */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-8 rounded-2xl glass-card "
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-linear-to-br from-primary/30 to-primary/5">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-display">
                  For Companies
                </h3>
                <p className="text-xs font-medium text-muted-foreground">
                  Hire smarter
                </p>
              </div>
            </div>
            <div className="space-y-1">
              {companyFeatures.map((f, i) => (
                <FeatureCard key={f.title} {...f} index={i} />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ForWho;
