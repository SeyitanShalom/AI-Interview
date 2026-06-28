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
    <section className="relative py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(183_100%_32%/0.06)_0%,transparent_55%)]" />
      <div className="container relative z-10 px-6 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <span className="block mb-3 text-xs font-semibold tracking-widest uppercase text-primary">
            Simple Process
          </span>
          <h2 className="mb-4 text-4xl font-display md:text-5xl">
            How It <span className="text-gradient-primary">Works</span>
          </h2>
          <p className="max-w-xl mx-auto md:text-lg text-muted-foreground">
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
              className="flex items-center gap-3 py-8 transition-colors border-b group border-border/40 last:border-0 hover:border-primary/20"
            >
              {/* <div className="flex items-center justify-center transition-colors shrink-0 w-14 h-14 rounded-2xl bg-primary/5 glow-border group-hover:bg-primary/10">
                <span className="text-lg font-extrabold font-display text-primary">
                  {step.number}
                </span>
              </div> */}
              <h1 className="text-6xl font-medium transition-colors duration-300 text-primary/20 group-hover:text-primary">
                {step.number}
              </h1>
              <div className="">
                <h3 className="mb-1 text-lg font-bold transition-colors duration-300 font-display group-hover:text-primary">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
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
