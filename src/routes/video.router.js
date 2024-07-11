import { Router } from "express";
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishAVideo,
  updateVideoDetails,
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/publishAVideo").post(
  verifyJWT,
  upload.fields([
    {
      name: "videoFile",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  publishAVideo
);
router.route("/getVideos").get(getAllVideos);
router.route("/getVideoById/:videoId").get(getVideoById);
router
  .route("/updateVideoDetails/:videoId")
  .patch(verifyJWT, upload.single("thumbnail"), updateVideoDetails);
router.route("/deleteVideo/:videoId").delete(verifyJWT, deleteVideo);

export default router;
