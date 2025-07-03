import mongoose from 'mongoose';
import slugify from 'slugify';

// Replace with your actual MongoDB URI
const MONGO_URI = 'mongodb+srv://reienhierde:reienhierde@cluster0.vmj8yiu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const blogSchema = new mongoose.Schema({
    title: String,
    slug: String,
});

const Blog = mongoose.model('Blog', blogSchema);

const generateSafeSlug = (title) =>
    slugify(title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
    });

async function fixBlogSlugs() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const blogs = await Blog.find({});

        for (const blog of blogs) {
            const safeSlug = generateSafeSlug(blog.title);

            if (blog.slug !== safeSlug) {
                console.log(`Updating slug for "${blog.title}" → ${safeSlug}`);
                blog.slug = safeSlug;
                await blog.save();
            } else {
                console.log(`Slug already safe for: "${blog.title}"`);
            }
        }

        console.log('✅ All slugs updated.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error updating slugs:', err);
        process.exit(1);
    }
}

fixBlogSlugs();
