import mongoose from 'mongoose';

const contentBlockSchema = new mongoose.Schema({
    type: {
        type: String,
        // 'widget' embeds an interactive component (e.g. the tyre price calculator)
        enum: ['heading', 'paragraph', 'list', 'widget'],
        required: true,
    },
    level: {
        type: String,
        enum: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    }, // only for heading
    text: String, // for heading and paragraph
    items: [String], // for list
    widget: String, // for widget, e.g. 'reifen-preisrechner'
    style: {
        type: String,
        enum: ['ul', 'ol'],
    }, // instead of `ordered`
}, { _id: false }); // don't auto-generate _id for inner objects

const blogSchema = new mongoose.Schema(
    {
        title: String,
        slug: String,
        coverImage: String,
        tags: [String],
        metaDescription: String,

        // ⚠️ now nested: array of array of blocks
        contentBlocks: [[contentBlockSchema]],
    },
    { timestamps: true }
);

export default mongoose.models.Blog || mongoose.model('Blog', blogSchema);
