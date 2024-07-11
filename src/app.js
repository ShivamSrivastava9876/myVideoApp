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
import likeRouter from "./routes/like.route.js";
import commentRouter from "./routes/comment.route.js";
import subscriptionRouter from "./routes/subscription.route.js";
import playlistRouter from "./routes/playlist.route.js";
import dashboardRouter from "./routes/dashboard.route.js";
import tweetRouter from "./routes/tweet.route.js";

//Routes declaration
app.use("/api/v1/users", userRouter);
app.use("/api/v1/video", videoRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/playlist", playlistRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/tweets", tweetRouter);

export { app };
