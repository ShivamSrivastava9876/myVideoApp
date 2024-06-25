import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

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
              $lookup: {
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
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
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
  const videoId = req.params;

  const verifyVideoInDb = await Video.findById(videoId);

  if (!verifyVideoInDb) {
    throw new ApiError(400, "The video you are searching for does not exist");
  }

  try {
    const video = await Video.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(videoId),
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
              $if: {
                $in: [req.user?._id, likes.likedBy],
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
    throw new ApiError(500, "Error while fetching the video");
  }
});

export { getAllVideos, publishAVideo, getVideoById };
