"use client";
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
  icon: any;
  title: string;
  desc: string;
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.08, duration: 0.4 }}
    className="flex items-center gap-4 p-4 rounded-xl hover:bg-primary/5 transition-all duration-300 group"
  >
    <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div>
      <h4 className=" font-semibold text-foreground text-base">
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
    <section className="py-28 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(160_84%_39%/0.04)_0%,transparent_50%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-primary/80 mb-3 block">
            Who It's For
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Built for <span className="text-gradient-primary">Everyone</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Whether you're preparing for your dream job or hiring the best
            talent.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Candidates */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-primary/30 to-primary/5 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold">
                  For Candidates
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
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
            className="rounded-2xl glass-card p-8 "
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-primary/30 to-primary/5 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold">
                  For Companies
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
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
