/// <reference path="./types/express.d.ts" />
import * as dotenv from "dotenv";
import { appRunner } from "./routes";

dotenv.config();
appRunner();
