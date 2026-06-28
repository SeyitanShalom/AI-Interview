import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/app/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { TrendingUp, Users, CheckCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface Session {
  id: string;
  user_id: string;
  job_role: string;
  question: string;
  status: string;
  overall_score: number | null;
  content_score: number | null;
  style_score: number | null;
  video_url: string | null;
  completed_at: string | null;
  created_at: string;
}

interface AnalyticsChartsProps {
  sessions: Session[];
  currentUserRole?: string | null;
}

const COMPLETION_COLORS = ["hsl(183 100% 32%)", "hsl(38 92% 50%)"];
const ROLE_BAR_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(183 80% 36%)",
  "hsl(43 96% 56%)",
  "hsl(330 81% 60%)",
  "hsl(199 89% 48%)",
  "hsl(142 71% 45%)",
  "hsl(24 95% 53%)",
  "hsl(262 83% 58%)",
];

const AnalyticsCharts = ({ sessions }: AnalyticsChartsProps) => {
  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.status === "completed");
    const pending = sessions.filter((s) => s.status === "pending");
    const totalCandidates = new Set(sessions.map((s) => s.user_id)).size;
    const avgScore =
      completed.length > 0
        ? Math.round(
            completed.reduce((sum, s) => sum + (s.overall_score || 0), 0) /
              completed.length,
          )
        : 0;
    return {
      completed: completed.length,
      pending: pending.length,
      totalCandidates,
      avgScore,
    };
  }, [sessions]);

  const scoreTrend = useMemo(() => {
    const completed = sessions
      .filter((s) => s.status === "completed" && s.overall_score != null)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

    const byDate: Record<
      string,
      { scores: number[]; content: number[]; style: number[] }
    > = {};
    completed.forEach((s) => {
      const date = new Date(s.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!byDate[date]) byDate[date] = { scores: [], content: [], style: [] };
      byDate[date].scores.push(s.overall_score!);
      if (s.content_score != null) byDate[date].content.push(s.content_score);
      if (s.style_score != null) byDate[date].style.push(s.style_score);
    });

    return Object.entries(byDate).map(([date, { scores, content, style }]) => ({
      date,
      overall: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      content: content.length
        ? Math.round(content.reduce((a, b) => a + b, 0) / content.length)
        : 0,
      style: style.length
        ? Math.round(style.reduce((a, b) => a + b, 0) / style.length)
        : 0,
    }));
  }, [sessions]);

  const completionData = useMemo(
    () => [
      { name: "Completed", value: stats.completed },
      { name: "In Progress", value: stats.pending },
    ],
    [stats],
  );

  const roleData = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach((s) => {
      counts[s.job_role] = (counts[s.job_role] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [sessions]);

  const chartConfig = {
    overall: { label: "Overall", color: "hsl(var(--primary))" },
    content: { label: "Content", color: "hsl(var(--accent))" },
    style: { label: "Clarity", color: "hsl(var(--muted-foreground))" },
    count: { label: "Sessions", color: ROLE_BAR_COLORS[0] },
  };

  const kpiCards = [
    { label: "Total Candidates", value: stats.totalCandidates, icon: Users },
    { label: "Completed", value: stats.completed, icon: CheckCircle },
    { label: "In Progress", value: stats.pending, icon: Clock },
    { label: "Avg Score", value: `${stats.avgScore}/100`, icon: TrendingUp },
  ];

  if (sessions.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            No session data yet. Analytics will appear once candidates complete
            interviews.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="glass-card hover:border-primary/20 transition-colors">
              <CardContent className="pt-6 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-display">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Score Trend */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">
                Score Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scoreTrend.length > 0 ? (
                <ChartContainer
                  config={chartConfig}
                  className="h-[250px] w-full"
                >
                  <LineChart data={scoreTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border/30"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="overall"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="content"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="style"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No completed sessions to chart.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Completion Pie */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">
                Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ChartContainer
                config={chartConfig}
                className="h-[250px] w-full max-w-[250px]"
              >
                <PieChart>
                  <Pie
                    data={completionData.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {completionData.map((_, i) => (
                      <Cell key={i} fill={COMPLETION_COLORS[i]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
            <div className="flex justify-center gap-6 pb-4">
              {completionData.map((d, i) => (
                <div
                  key={d.name}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COMPLETION_COLORS[i] }}
                  />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Sessions by Role */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="md:col-span-2"
        >
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">
                Sessions by Role
              </CardTitle>
            </CardHeader>
            <CardContent>
              {roleData.length > 0 ? (
                <ChartContainer
                  config={chartConfig}
                  className="h-[250px] w-full"
                >
                  <BarChart data={roleData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border/30"
                    />
                    <XAxis
                      dataKey="role"
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                    >
                      {roleData.map((entry, index) => (
                        <Cell
                          key={entry.role}
                          fill={ROLE_BAR_COLORS[index % ROLE_BAR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No sessions yet.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
