import express from "express";
import cors from "cors";
import { healthRouter } from "./health";

const PORT = process.env.PORT || 3001;

export function appRunner() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(healthRouter);
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
