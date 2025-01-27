import mongoose,{Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber:{
        type:Schema.Types.ObjectId, // one who is subscribing the user
        ref:"User",
    },
    channel:{
        type:Schema.Types.ObjectId, // How many subscribers we have or on our channels
        ref:"User",
    }
},{
    timestamps:true
}
)

export const Subscription = mongoose.model("Subscription",subscriptionSchema);