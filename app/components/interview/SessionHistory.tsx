import { motion } from "framer-motion";
import { Clock, TrendingUp, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { format } from "date-fns";

interface Session {
  id: string;
  job_role: string;
  question: string;
  overall_score: number | null;
  status: string;
  created_at: string;
}

const SessionHistory = ({
  sessions,
  onSelect,
}: {
  sessions: Session[];
  onSelect: (id: string) => void;
}) => {
  if (!sessions.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>No practice sessions yet. Start your first interview!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session, i) => (
        <motion.div
          key={session.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Card
            className="glass-card hover:border-primary/25 cursor-pointer transition-all group"
            onClick={() => onSelect(session.id)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/15">
                    {session.job_role}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(session.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
                <p className="text-sm text-foreground truncate">
                  {session.question}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {session.overall_score !== null && (
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-lg font-bold font-display text-foreground">
                      {session.overall_score}
                    </span>
                  </div>
                )}
                {session.status === "pending" && (
                  <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2.5 py-0.5 rounded-full border border-yellow-400/15">
                    In Progress
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default SessionHistory;
