import cron from "node-cron";
import { checkOverdueLoans } from "../app/book/service";

cron.schedule("0 8 * * *", async () => {
  console.log("Checking overdue books...");
  await checkOverdueLoans();
});

export default cron;
