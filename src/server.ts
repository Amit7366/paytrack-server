import { createApp } from "./app";
import { connectDatabase } from "./config/db";
import { env } from "./config/env";

const start = async () => {
  await connectDatabase();
  const app = createApp();

  // app.listen(env.port, "127.0.0.1", () => {
  //   console.log(`API listening on http://127.0.0.1:${env.port}`);
  // });
  const PORT = Number(process.env.PORT) || 10000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API listening on http://0.0.0.0:${PORT}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
