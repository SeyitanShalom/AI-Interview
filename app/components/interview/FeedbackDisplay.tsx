import { motion } from "framer-motion";
import {
  CheckCircle,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  Mic2,
} from "lucide-react";
import { Progress } from "@/app/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";

interface Feedback {
  rubric_scores?: {
    content: number;
    structure: number;
    clarity: number;
    impact: number;
  };
  content_score: number;
  style_score: number;
  overall_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  content_analysis: string;
  style_analysis: string;
}

const ScoreBar = ({
  label,
  score,
  icon: Icon,
}: {
  label: string;
  score: number;
  icon: React.ElementType;
}) => {
  const color =
    score >= 70
      ? "text-primary"
      : score >= 50
        ? "text-yellow-400"
        : "text-destructive";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className={`text-lg font-bold font-display ${color}`}>
          {score}/100
        </span>
      </div>
      <Progress value={score} className="h-2" />
    </div>
  );
};

const FeedbackDisplay = ({ feedback }: { feedback: Feedback }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Summary */}
      <Card className="glass-card glow-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 font-display">
            <TrendingUp className="w-5 h-5 text-primary" /> Overall Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-muted-foreground leading-relaxed">
            {feedback.summary}
          </p>
          <div className="space-y-4">
            <ScoreBar
              label="Content Quality"
              score={feedback.content_score}
              icon={MessageSquare}
            />
            <ScoreBar
              label="Communication Clarity"
              score={feedback.style_score}
              icon={Mic2}
            />
            <ScoreBar
              label="Overall Score"
              score={feedback.overall_score}
              icon={TrendingUp}
            />
          </div>
        </CardContent>
      </Card>

      {feedback.rubric_scores && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 font-display">
              <TrendingUp className="w-5 h-5 text-primary" /> Rubric Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoreBar
              label="Content"
              score={feedback.rubric_scores.content}
              icon={MessageSquare}
            />
            <ScoreBar
              label="Structure"
              score={feedback.rubric_scores.structure}
              icon={TrendingUp}
            />
            <ScoreBar
              label="Clarity"
              score={feedback.rubric_scores.clarity}
              icon={Mic2}
            />
            <ScoreBar
              label="Impact"
              score={feedback.rubric_scores.impact}
              icon={CheckCircle}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Strengths */}
        <Card className="glass-card border-primary/15">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 font-display">
              <CheckCircle className="w-4 h-4 text-primary" /> Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {feedback.strengths.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-2.5 text-sm text-muted-foreground"
                >
                  <span className="text-primary mt-0.5 shrink-0">✓</span> {s}
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Improvements */}
        <Card className="glass-card border-yellow-500/15">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 font-display">
              <AlertCircle className="w-4 h-4 text-yellow-400" /> Areas to
              Improve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {feedback.improvements.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-2.5 text-sm text-muted-foreground"
                >
                  <span className="text-yellow-400 mt-0.5 shrink-0">→</span> {s}
                </motion.li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">
              Content Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {feedback.content_analysis}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">
              Clarity Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {feedback.style_analysis}
            </p>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default FeedbackDisplay;
