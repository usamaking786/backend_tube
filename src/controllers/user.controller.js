import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req,res)=>{
    // get user details from frontend
    const {username, email,fullname, password} = req.body;
    
    // validation
    if([username,email,fullname,password].some(field => field.trim() === "")){
        throw new ApiError(400,"All fields are required");
    }
    
    // check if user already exist
    const existedUser = await User.findOne({
        $or:[{username},{email}]
    });

    if(existedUser){    
    throw new ApiError(409,"User with same name and email already exists");
    }

    // check for iamges or check for avatar - if available
    const avatarLocalPath = req.files?.avatar[0].path;
    // console.log(req.files);
    
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required");
    }

    
    // upload on cloudinary, avatar is uploaded
    const avatar= await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    // create user object now - create db entry
    const user = await User.create({
        username,
        email,
        fullname,
        password,
        avatar:avatar.url,
        coverImage: coverImage?.url || "",
    })

    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    // check for user creation
    if(!createdUser){
    throw new ApiError(500, "Data not found into the database or User not created");
    }
    // return response

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

});

export {registerUser}