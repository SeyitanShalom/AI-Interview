import { motion } from "framer-motion";
import { Bot, Mic } from "lucide-react";

interface AIInterviewerProps {
  question: string;
  isThinking: boolean;
  isSpeaking: boolean;
}

const AIInterviewer = ({
  question,
  isThinking,
  isSpeaking,
}: AIInterviewerProps) => {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* AI Avatar */}
      <div className="relative">
        <motion.div
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center shadow-[0_0_30px_-8px_hsl(var(--primary)/0.3)]"
          animate={
            isSpeaking
              ? {
                  scale: [1, 1.06, 1],
                  borderColor: [
                    "hsl(var(--primary) / 0.3)",
                    "hsl(var(--primary) / 0.6)",
                    "hsl(var(--primary) / 0.3)",
                  ],
                }
              : isThinking
                ? { rotate: [0, 3, -3, 0] }
                : {}
          }
          transition={{ repeat: Infinity, duration: isSpeaking ? 1.2 : 2 }}
        >
          <Bot className="w-10 h-10 text-primary" />
        </motion.div>
        {isSpeaking && (
          <motion.div
            className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[0_0_12px_-2px_hsl(var(--primary)/0.5)]"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.6 }}
          >
            <Mic className="w-3.5 h-3.5 text-primary-foreground" />
          </motion.div>
        )}
      </div>

      {/* Question bubble */}
      <motion.div
        className="max-w-md rounded-2xl glass-card p-5 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        key={question}
      >
        {isThinking ? (
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary/60"
                animate={{ y: [0, -6, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.6,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-foreground font-medium leading-relaxed">
            {question}
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default AIInterviewer;
