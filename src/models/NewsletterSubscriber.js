import mongoose from "mongoose";

const newsletterSubscriberSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ["subscribed", "unsubscribed"],
            default: "subscribed",
        },
        subscribedAt: {
            type: Date,
            default: Date.now,
        },
        unsubscribedAt: {
            type: Date,
        },
        reSubscribedAt: {
            type: Date,
        },
        source: { type: String }, // e.g. footer_form, popup, etc.
        ip: { type: String },
    },
    { timestamps: true }
);

export default mongoose.model(
    "NewsletterSubscriber",
    newsletterSubscriberSchema
);
