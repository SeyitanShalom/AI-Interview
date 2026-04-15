"use client";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Choose Your Role",
    desc: "Select the position you're interviewing for or create a custom interview set.",
  },
  {
    number: "02",
    title: "Record Your Answers",
    desc: "Answer questions on video at your own pace. Our AI adapts to your responses.",
  },
  {
    number: "03",
    title: "Get AI Feedback",
    desc: "Receive detailed analysis on content quality, delivery, and body language.",
  },
  {
    number: "04",
    title: "Improve & Repeat",
    desc: "Track your progress, identify weak areas, and practice until you're confident.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-28 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(160_84%_39%/0.06)_0%,transparent_55%)]" />
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-xs font-semibold tracking-widest uppercase text-primary/80 mb-3 block">
            Simple Process
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            How It <span className="text-gradient-primary">Works</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From setup to success in four simple steps.
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="group flex items-center gap-3 py-8 border-b border-border/40 last:border-0 hover:border-primary/20 transition-colors"
            >
              {/* <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary/5 glow-border flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <span className="font-display text-lg font-extrabold text-primary">
                  {step.number}
                </span>
              </div> */}
              <h1 className="text-primary/20 group-hover:text-primary text-6xl font-medium transition-colors duration-300">
                {step.number}
              </h1>
              <div className="">
                <h3 className="font-display text-lg font-bold mb-1 group-hover:text-primary transition-colors duration-300">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {step.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
