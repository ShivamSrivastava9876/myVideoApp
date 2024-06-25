import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

//Common middlewares
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "20kb",
  })
);

app.use(express.static("public"));

app.use(
  express.urlencoded({
    extended: true,
    limit: "20kb",
  })
);

//Routes
import userRouter from "./routes/user.route.js";
import videoRouter from "./routes/video.router.js";
//Routes declaration
app.use("/api/v1/users", userRouter);
app.use("/api/v1/video", videoRouter)

export { app };