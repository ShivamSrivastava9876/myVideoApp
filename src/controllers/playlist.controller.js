import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new ApiError(400, "Name is required");
  }

  if (!description) {
    throw new ApiError(400, "Description is required");
  }

  try {
    const createdPlaylist = await Playlist.create({
      name,
      description,
      owner: req.user?._id,
    });

    if (!createPlaylist) {
      throw new ApiError(500, "Error in creating playlist");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, createdPlaylist, "Playlist created successfully")
      );
  } catch (error) {
    throw new ApiError(500, `Error in creating playlist: ${error}`);
  }
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
})

export { createPlaylist };

