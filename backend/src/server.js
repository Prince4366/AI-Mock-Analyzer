import dotenv from "dotenv";
dotenv.config();

import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { runStreakResetValidationJob } from "./services/streakService.js";
import { ensureDefaultBadges } from "./services/badgeService.js";
import { runWeeklyGoalResetValidationJob } from "./services/weeklyGoalService.js";

async function bootstrap() {
  await connectDB();
  await ensureDefaultBadges();

  await runStreakResetValidationJob();
  await runWeeklyGoalResetValidationJob();
  setInterval(() => {
    runStreakResetValidationJob().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Streak reset validation failed", error);
    });
    runWeeklyGoalResetValidationJob().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Weekly goal reset validation failed", error);
    });
  }, 60 * 60 * 1000);

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
