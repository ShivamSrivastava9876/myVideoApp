import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10, sortType = -1 } = req.query;

  const newPage = parseInt(page);
  const newLimit = parseInt(limit);
  const docsToBeSkipped = newPage * newLimit - newLimit;

  if (!videoId) {
    throw new ApiError(400, "Video Id not found");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const comment = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $project: {
              title: 1,
              description: 1,
              isPublished: 1,
            },
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
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likesOnComment",
      },
    },
    {
      $addFields: {
        isLiked: {
          $cond: {
            if: {
              $in: [req.user?._id, "$likesOnComment.likedBy"],
            },
            then: true,
            else: false,
          },
        },
        likesOnComment: {
          $size: "$likesOnComment",
        },
        video: {
          $first: "$video",
        },
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $sort: {
        updatedAt: sortType,
      },
    },
    {
      $skip: docsToBeSkipped,
    },
    {
      $limit: limit,
    },
  ]);

  return res.status(200).json(new ApiResponse(200, comment));
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!videoId) {
    throw new ApiError(400, "Video Id not found");
  }

  if (!content) {
    throw new ApiError(400, "Please give the comment");
  }

  try {
    const video = await Video.findById(videoId);

    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    const commentAdded = await Comment.create({
      content,
      video: videoId,
      owner: req.user?._id,
    });

    if (!commentAdded) {
      throw new ApiError(400, "Error in comment creation");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, commentAdded, "Comment added successfully"));
  } catch (error) {
    throw new ApiError(500, { errorMessage: error });
  }
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { newComment } = req.body;

  if (!commentId) {
    throw new ApiError(400, "Invalid comment Id");
  }

  if (!newComment) {
    throw new ApiError(400, "Please share the content you want to update");
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: {
        content: newComment,
      },
    },
    { new: true }
  );

  if (!updatedComment) {
    throw new ApiError(500, "Error in updating the comment");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const {commentId} = req.params

  if(!commentId){
      throw new ApiError(400, "Please give comment ID which you want to update.")
  }

  try {
      const comment = await Comment.findByIdAndDelete(commentId)
  
      if(!comment){
          throw new ApiError(500, "Error in deleting the comment.")
      }
  
      return res
      .status(200)
      .json(
          new ApiResponse(200, {}, "Comment deleted successfully.")
      )
  } 
  catch (error) {
      throw new ApiError(500, "Getting error in deleting the comment.")
  }
})

export { getVideoComments, addComment, updateComment, deleteComment };
