import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  const pageNumber = parseInt(page);
  const pageLimit = parseInt(limit);
  const skipValue = pageLimit * (pageNumber - 1);

  if (!query) {
    throw new ApiError(400, "Provide query to retrieve videos");
  }

  if (!sortBy) {
    throw new ApiError(400, "Provide field name to be sorted");
  }

  if (!sortType) {
    throw new ApiError(400, "Provide sorting type");
  }

  if (!userId) {
    //If required in future
  }

  try {
    const videos = await Video.aggregate([
      {
        $match: {
          $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
          ],
          isPublished: true,
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes",
          pipeline: [
            {
              $count: "totalLikes",
            },
          ],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $project: {
                username: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          owner: {
            $first: $owner.username,
          },
          likes: {
            $cond: {
              if: {
                $eq: ["$likes.totalLikes", 0],
              },
              then: {
                totalLikes: 0,
              },
              else: {
                $first: "$likes.totalLikes",
              },
            },
          },
        },
      },
      {
        $project: {
          //_id is automatically considered so no need to specify it separately
          title: 1,
          description: 1,
          videoFile: 1,
          thumbnail: 1,
          duration: 1,
          views: 1,
          isPublished: 1,
          owner: 1,
          createdAt: 1,
          updatedAt: 1,
          likes: 1,
        },
      },
      {
        $sort: { [sortBy]: sortType === "asc" ? 1 : -1 },
      },
      {
        $skip: skipValue,
      },
      {
        $limit: pageLimit,
      },
    ]);

    if (videos.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, { videos }, "No videos available"));
    } else {
      return res
        .status(200)
        .json(new ApiResponse(200, { videos }, "Videos fetched successfully"));
    }
  } catch (error) {
    throw new ApiError(
      500,
      `Fetching videos from database has errors, ${error}`
    );
  }
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (
    [title, description].some((ele) => {
      ele?.trim() === "";
    })
  ) {
    throw new ApiError(
      400,
      "Please send all required fields: title, description"
    );
  }

  const videoFilePath = req.files?.videoFile[0].path;
  const thumbnailPath = req.files?.thumbnail[0].path;

  if (!videoFilePath) {
    throw new ApiError(400, "Video file is missing");
  }

  if (!thumbnailPath) {
    throw new ApiError(400, "Thumbnail is missing");
  }

  const videoFile = await uploadOnCloudinary(videoFilePath);
  const thumbnail = await uploadOnCloudinary(thumbnailPath);

  if (!videoFile) {
    throw new ApiError(400, "Video file upload failed");
  }

  if (!thumbnail) {
    throw new ApiError(400, "Thumbnail upload failed");
  }

  const video = await Video.create({
    videoFile: {
      url: videoFile.secure_url,
      public_id: videoFile.public_id,
    },
    thumbnail: {
      url: thumbnail.secure_url,
      public_id: thumbnail.public_id,
    },
    title,
    description,
    duration: videoFile.duration, // check duration
    owner: req.user?._id,
  });

  const videoUploaded = await Video.findById(video._id).exec();

  if (!videoUploaded) {
    throw new ApiError(
      "500",
      "Video upload failed due to server error, please try again !!!"
    );
  }

  return res
    .status(201)
    .json(new ApiResponse(201, videoUploaded, "Video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const verifyVideoInDb = await Video.findById(videoId);

  if (!verifyVideoInDb) {
    throw new ApiError(400, "The video you are searching for does not exist");
  }

  try {
    const video = await Video.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(videoId),
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes",
        },
      },
      {
        $addFields: {
          totalLikes: {
            $size: "$likes",
          },
          isLiked: {
            $cond: {
              if: {
                $in: [req.user?._id, [Like.likedBy]],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          "videofile.url": 1,
          title: 1,
          description: 1,
          views: 1,
          createdAt: 1,
          duration: 1,
          comments: 1,
          likes: 1,
          isLiked: 1,
        },
      },
    ]);

    return res
      .status(200)
      .json(new ApiResponse(200, video, "Video fetched successfully."));
  } catch (error) {
    throw new ApiError(500, `Error while fetching the video: ${error}`);
  }
});

const updateVideoDetails = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const thumbnailPath = req.file?.path;
  const { videoId } = req.params;
  let updatedFields = {};

  if (title) {
    updatedFields.title = title;
  }

  if (description) {
    updatedFields.description = description;
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Provide valid video Id");
  }

  const video = await Video.findById(videoId);

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      400,
      "You are not the owner so you cannot make changes to the video"
    );
  }

  let updatedThumbnail;
  if (thumbnailPath) {
    updatedThumbnail = await uploadOnCloudinary(thumbnailPath);
    updatedFields.thumbnail = {
      url: updatedThumbnail.secure_url,
      public_id: updatedThumbnail.public_id,
    };
  }

  const updatedVideoDetails = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: updatedFields,
    },
    { new: true } // It will ensure that updated document is returned
  );

  if (!updatedVideoDetails) {
    throw new ApiError(500, "Failed to update the video details");
  }

  if (thumbnailPath) {
    const deletePreviousThumbnailFromCloudinary = await deleteFromCloudinary(
      video.thumbnail.public_id
    );
    console.log(deletePreviousThumbnailFromCloudinary, "delete status");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        updatedVideoDetails,
        "Video details updated successfully"
      )
    );
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video Id");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "Video does not exist");
  }

  if (req.user?._id.toString() !== video?.owner.toString()) {
    throw new ApiError(
      400,
      "Invalid request, you are not the owner of this video"
    );
  }

  const videoDeleted = await Video.findByIdAndDelete(video._id);

  if (!videoDeleted) {
    throw new ApiError(500, "Video deletion unsuccessfull, please try again");
  }

  console.log("video", video);
  await deleteFromCloudinary(video.videoFile.public_id, "video");
  await deleteFromCloudinary(video.thumbnail.public_id);

  const deletedLikeDocuments = await Like.deleteMany({ video: video._id });
  const deletedCommentDocuments = await Comment.deleteMany({
    video: video._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideoDetails,
  deleteVideo,
};
