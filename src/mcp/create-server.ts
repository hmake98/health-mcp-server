import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { connectDB } from "../db/connection.js";
import { getVitals, getLatestVitals } from "./tools/vitals.js";
import { getSleepSummary } from "./tools/sleep.js";
import { getWorkouts } from "./tools/workouts.js";
import { getActivity } from "./tools/activity.js";
import { getHealthCoachingSnapshot } from "./tools/coaching.js";

export function createMcpServer(): McpServer {
  const DEFAULT_USER = process.env.DEFAULT_USER_ID ?? "default";

  const server = new McpServer(
    { name: "health-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "get_health_coaching_snapshot",
    {
      description:
        "PRIMARY tool for any health coaching question. " +
        "Call this FIRST whenever the user asks: should I exercise today, how is my recovery, am I overtraining, how was my sleep, how do I feel, or any question about readiness/energy/fatigue. " +
        "Returns a computed readiness score (0–100), HRV vs personal 30-day baseline, resting heart rate trend, last night's sleep with stage breakdown vs 30-day average, recent training load (3/7/14 day windows), consecutive training days, and today's activity. " +
        "All values are anchored to the user's own baselines — not population norms. " +
        "Use the readiness.signals array to build a personalized, data-driven answer. Always cite specific numbers.",
      inputSchema: {
        date: z.string().optional().describe("ISO 8601 date to anchor the snapshot (default: today)"),
      },
    },
    async (args) => {
      await connectDB();
      const result = await getHealthCoachingSnapshot({ userId: DEFAULT_USER, ...args });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_latest_vitals",
    {
      description:
        "Get the most recent reading for each vital sign: heart rate, resting heart rate, HRV, blood oxygen, blood pressure. " +
        "Use get_health_coaching_snapshot instead when answering coaching or readiness questions — this tool is for point-in-time vital lookups only.",
    },
    async () => {
      await connectDB();
      const result = await getLatestVitals({ userId: DEFAULT_USER });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_vitals",
    {
      description: "Query vital sign history with optional type and date filters.",
      inputSchema: {
        type: z.enum([
          "heart_rate", "resting_heart_rate", "hrv", "blood_oxygen",
          "blood_pressure_systolic", "blood_pressure_diastolic",
          "respiratory_rate", "walking_heart_rate_average",
        ]).optional().describe("Filter by vital type"),
        from: z.string().optional().describe("ISO 8601 start date"),
        to:   z.string().optional().describe("ISO 8601 end date"),
        limit: z.number().optional().describe("Max records to return (default 100)"),
      },
    },
    async (args) => {
      await connectDB();
      const result = await getVitals({ userId: DEFAULT_USER, ...args });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_sleep_summary",
    {
      description:
        "Get sleep data grouped by night, including stage breakdown (deep, REM, core, awake) and efficiency. Defaults to last 7 days. " +
        "Each entry's 'date' is the evening the sleep session began (e.g. '2026-06-09' covers sleep from the evening of June 9 through the morning of June 10). " +
        "For coaching questions ('how was my sleep?', 'should I exercise?') prefer get_health_coaching_snapshot which includes sleep vs 30-day baseline and readiness scoring. " +
        "Use this tool when the user wants a multi-night log or detailed stage history beyond what the snapshot provides.",
      inputSchema: {
        from: z.string().optional().describe("ISO 8601 start date"),
        to:   z.string().optional().describe("ISO 8601 end date"),
        days: z.number().optional().describe("Number of past days to fetch (default 7)"),
      },
    },
    async (args) => {
      await connectDB();
      const result = await getSleepSummary({ userId: DEFAULT_USER, ...args });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_workouts",
    {
      description: "Get workout history with summary stats (total kcal, distance, count by type).",
      inputSchema: {
        workoutType: z.string().optional().describe("Filter by type e.g. 'Running', 'Cycling'"),
        from:  z.string().optional().describe("ISO 8601 start date"),
        to:    z.string().optional().describe("ISO 8601 end date"),
        limit: z.number().optional().describe("Max records (default 50)"),
      },
    },
    async (args) => {
      await connectDB();
      const result = await getWorkouts({ userId: DEFAULT_USER, ...args });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_activity",
    {
      description:
        "Get daily activity data: steps, distance, active calories, exercise minutes. Defaults to last 7 days. " +
        "For coaching or readiness questions use get_health_coaching_snapshot instead — it already includes 7-day activity averages and today's step count.",
      inputSchema: {
        from: z.string().optional().describe("ISO 8601 start date"),
        to:   z.string().optional().describe("ISO 8601 end date"),
        days: z.number().optional().describe("Number of past days (default 7)"),
      },
    },
    async (args) => {
      await connectDB();
      const result = await getActivity({ userId: DEFAULT_USER, ...args });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
