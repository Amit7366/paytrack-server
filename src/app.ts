import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFound } from "./common/middleware/error.middleware";
import routes from "./routes";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

  app.use("/api", routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
