import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        if (!user) {
            throw new ApiError(404, "User not found in generating access and refresh token");
        }
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        console.error("Error generating tokens:", error);
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

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

const loginUser = asyncHandler(async (req,res)=>{
    // Algorithm for login
    // 1. get values from request
    const {username,email,password} = req.body;
    // 2. Validation
    if([username,email].some(field => field.trim() === "")){
        throw new ApiError(400,"username and email are required");
    }
    // Check user is available or not
    const user = await User.findOne({
        $or:[{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"User not found. Please Register first");
    }
    // check password is correct or not
    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if(!isPasswordCorrect){
        throw new ApiError(400,"Incorrect Password");
    }
    
    // generate access token and refresh token 
    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id);
    // Find login user
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req,res)=>{
    const user = req.user;
    await User.findByIdAndUpdate(
        req.user._id,
        {
        $set:{
            refreshToken : undefined
        }
        },
        {
            new:true
        }
    );

    const options = {
        httpOnly: true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200,{},"User logged out successfully")
    );
})


export {
    registerUser,
    loginUser,
    logoutUser
}

