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

const refreshAccessToken = asyncHandler(async (req,res)=>{
const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
if(!incomingRefreshToken){
    throw new ApiError(401,"Refresh Token is expired or used not available");
}

    const decodedRefreshToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

    if(!decodedRefreshToken){
        throw new ApiError(401,"Refresh Token is expired or not matched with secret key");
    }

    const user = await User.findById(decodedRefreshToken._id).select("-password");
    if(!user)
    {
        throw new ApiError(401,"User not found with refreshToken, is expired");
    }

    if(user?.refreshToken !== incomingRefreshToken){
        throw new ApiError(401,"Refresh Token is expired or used already");
    }

    const options = {
        httpOnly: true,
        secure: true
    }

    const {accessToken,newRefreshToken} = await generateAccessAndRefereshTokens(user._id);

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {user,accessToken,refreshToken:newRefreshToken }, "Access token refreshed successfully")
    )

    

})

const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user._id);
    
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new ApiError(400,"Incorrect Password please type a correct password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(
        new ApiResponse(200,{}, "Password changed successfully")
    )

})

const getCurrentUser = asyncHandler(async (req,res)=>{
    return res
    .status(200)
    .json(
        new ApiResponse(200, req.user, "User Fetched Successfully") 
    )  
})

const updateAccountDetails = asyncHandler(async (req,res)=>{
    const {fullname,email} = req.body;
    if(!fullname || !email){
        throw new ApiError(400,"All fields are required");
    }
    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {
            new: true
        }
    ).select("-password")
    
    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedUser, "Account details updated successfully")
    )  
})

const updateUserAvatar = asyncHandler(
    async(req,res)=>{
        const avatarLocalPath = req.file?.path;
        if(!avatarLocalPath){
            throw new ApiError(400, "Avatar File is missing")
        }

        // TODO: Delete Old Image Assignment

        const avatar = await uploadOnCloudinary(avatarLocalPath);

        const updateUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    avatar: avatar.url
                }
            },
            {
                new :true
            }
        ).select("-password");

        return res
        .status(200)
        .json(
            new ApiResponse(200, updateUser, "Avatar Image Updated Successfully" )
        )

    }
)

const updateUserCoverImage = asyncHandler(
    async(req,res)=>{
        const coverImageLocalPath = req.file?.path;
        if(!coverImageLocalPath){
            throw new ApiError(400, "Avatar File is missing")
        }

        // TODO: Delete Old Image Assignment

        const coverImage = await uploadOnCloudinary(coverImageLocalPath);

        const updateUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    coverImage: coverImage.url
                }
            },
            {
                new :true
            }
        ).select("-password");

        return res
        .status(200)
        .json(
            new ApiResponse(200, updateUser, "CoverImage Updated Successfully" )
        )

    }
)

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
}

