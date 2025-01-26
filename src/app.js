import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app =express();

// cors allow all the request from the specicivic cros origin
app.use(cors({
origin:process.env.CORS_ORIGIN,
credentials:true,
}));

app.use(express.json({
    limit:"16kb"
}))

// inthe form of url data when arrived it can take it also into the form of object. Here extended means
app.use(express.urlencoded({
    extended:true,
    limit:"16kb"
}));

app.use(express.static("public"));
// cookie will enhance the security and the privacy
app.use(cookieParser());

// import Routers here

import userRouter from "./routes/user.routes.js"

app.use("/api/v1/users",userRouter);

export default app;