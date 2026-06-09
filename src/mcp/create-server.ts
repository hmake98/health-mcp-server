import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { connectDB } from "../db/connection.js";
import { getVitals, getLatestVitals } from "./tools/vitals.js";
import { getSleepSummary } from "./tools/sleep.js";
import { getWorkouts } from "./tools/workouts.js";
import { getActivity } from "./tools/activity.js";

export function createMcpServer(): Server {
  const DEFAULT_USER = process.env.DEFAULT_USER_ID ?? "default";

  const server = new Server(
    { name: "health-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_latest_vitals",
        description:
          "Get the most recent reading for each vital sign: heart rate, resting heart rate, HRV, blood oxygen, blood pressure systolic, blood pressure diastolic.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_vitals",
        description: "Query vital sign history with optional type and date filters.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["heart_rate", "resting_heart_rate", "hrv", "blood_oxygen", "blood_pressure_systolic", "blood_pressure_diastolic", "respiratory_rate", "walking_heart_rate_average"],
              description: "Filter by vital type",
            },
            from: { type: "string", description: "ISO 8601 start date" },
            to: { type: "string", description: "ISO 8601 end date" },
            limit: { type: "number", description: "Max records to return (default 100)" },
          },
        },
      },
      {
        name: "get_sleep_summary",
        description:
          "Get sleep data grouped by night, including stage breakdown (deep, REM, core, awake). Defaults to last 7 days.",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "ISO 8601 start date" },
            to: { type: "string", description: "ISO 8601 end date" },
            days: { type: "number", description: "Number of past days to fetch (default 7)" },
          },
        },
      },
      {
        name: "get_workouts",
        description: "Get workout history with summary stats (total kcal, distance, count by type).",
        inputSchema: {
          type: "object",
          properties: {
            workoutType: { type: "string", description: "Filter by type e.g. 'Running', 'Cycling'" },
            from: { type: "string", description: "ISO 8601 start date" },
            to: { type: "string", description: "ISO 8601 end date" },
            limit: { type: "number", description: "Max records (default 50)" },
          },
        },
      },
      {
        name: "get_activity",
        description:
          "Get daily activity data: steps, distance, active calories, exercise minutes. Defaults to last 7 days.",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "ISO 8601 start date" },
            to: { type: "string", description: "ISO 8601 end date" },
            days: { type: "number", description: "Number of past days (default 7)" },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    await connectDB();
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    const userId = DEFAULT_USER;

    let result: unknown;

    switch (req.params.name) {
      case "get_latest_vitals":
        result = await getLatestVitals({ userId });
        break;
      case "get_vitals":
        result = await getVitals({
          userId,
          type: args.type as string | undefined,
          from: args.from as string | undefined,
          to: args.to as string | undefined,
          limit: args.limit as number | undefined,
        });
        break;
      case "get_sleep_summary":
        result = await getSleepSummary({
          userId,
          from: args.from as string | undefined,
          to: args.to as string | undefined,
          days: args.days as number | undefined,
        });
        break;
      case "get_workouts":
        result = await getWorkouts({
          userId,
          workoutType: args.workoutType as string | undefined,
          from: args.from as string | undefined,
          to: args.to as string | undefined,
          limit: args.limit as number | undefined,
        });
        break;
      case "get_activity":
        result = await getActivity({
          userId,
          from: args.from as string | undefined,
          to: args.to as string | undefined,
          days: args.days as number | undefined,
        });
        break;
      default:
        throw new Error(`Unknown tool: ${req.params.name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  return server;
}
