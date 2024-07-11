import mongoose, { isValidObjectId } from "mongoose";
import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const subscriberId = req.user?._id;

  if (!channelId) {
    throw new ApiError(400, "Channel Id is required");
  }

  if (subscriberId.equals(channelId)) {
    throw new ApiError(400, "User cannot subscribe self");
  }

  const isChannelSubscribed = await Subscription.findOne({
    subscriber: subscriberId,
    channel: channelId,
  });

  if (isChannelSubscribed) {
    const channelUnsubscribedStatus = await Subscription.findByIdAndDelete(
      isChannelSubscribed._id
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { channelUnsubscribedStatus, status: "Unsubscribed" },
          "Channel unsubscribed successfully"
        )
      );
  }

  const channelSubscribedStatus = await Subscription.create({
    subscriber: subscriberId,
    channel: channelId,
  });
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { channelSubscribedStatus, status: "Subscribed" },
        "Channel subscribed successfully"
      )
    );
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Channel Id is not valid");
  }

  try {
    const subscribers = await Subscription.aggregate([
      {
        $match: {
          channel: mongoose.Types.ObjectId.createFromHexString(channelId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "subscriber",
          foreignField: "_id",
          as: "subscriber",
          pipeline: [
            {
              $project: {
                username: 1,
                email: 1,
                fullName: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "channel",
          foreignField: "_id",
          as: "channel",
          pipeline: [
            {
              $project: {
                username: 1,
                email: 1,
                fullName: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          subscriber: {
            $arrayElemAt: ["$subscriber", 0],
          },
          channel: {
            $arrayElemAt: ["$channel", 0],
          },
        },
      },
    ]);

    if (!subscribers.length) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No subscribers found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          subscribers,
          "Fetched subscribers list successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, "Error while fetching errors: ", error.message);
  }
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const subscribedChannelsList = await Subscription.aggregate([
    {
      $match: {
        subscriber: req.user?._id,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $project: {
              username: 1,
              email: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
        pipeline: [
          {
            $project: {
              username: 1,
              email: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        subscriber: {
          $arrayElemAt: ["$subscriber", 0],
        },
        channel: {
          $arrayElemAt: ["$channel", 0],
        },
      },
    },
  ]);

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannelsList,
        "List of subscribed channels"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
