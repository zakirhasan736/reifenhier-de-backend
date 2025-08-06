import Blog from '../../models/Blog.js';
import slugify from 'slugify';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Directory for frontend images
const FRONTEND_BLOG_IMAGE_DIR = path.resolve(
    process.env.FRONTEND_BLOG_IMAGE_DIR ||
    '../../frontend/public/images/blogs'
);

// Directory for admin images
const ADMIN_BLOG_IMAGE_DIR = path.resolve(
    process.env.ADMIN_BLOG_IMAGE_DIR ||
    '../../admin/public/images/blogs'
);

// Ensure both folders exist!
fs.mkdirSync(FRONTEND_BLOG_IMAGE_DIR, { recursive: true });
fs.mkdirSync(ADMIN_BLOG_IMAGE_DIR, { recursive: true });

// Multer memory storage config
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// --- Helper: save buffer to both locations ---
function saveToBothBlogDirs(filename, buffer) {
    fs.writeFileSync(path.join(FRONTEND_BLOG_IMAGE_DIR, filename), buffer);
    fs.writeFileSync(path.join(ADMIN_BLOG_IMAGE_DIR, filename), buffer);
}

// --- Create Blog ---
export const createBlog = async (req, res) => {
    try {
        const { title, contentBlocks, tags, metaDescription } = req.body;
        if (!contentBlocks)
            return res.status(400).json({ message: 'Content blocks are required' });

        const parsedBlocks =
            typeof contentBlocks === 'string'
                ? JSON.parse(contentBlocks)
                : contentBlocks;
        const slug = slugify(title, { lower: true, strict: true });

        // Check if blog slug exists
        const existing = await Blog.findOne({ slug });
        if (existing)
            return res.status(400).json({ message: 'A blog with this title already exists.' });

        let image = null;
        if (req.file) {
            const ext = path.extname(req.file.originalname);
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
            const filename = `${slug}-${unique}${ext}`;
            saveToBothBlogDirs(filename, req.file.buffer);
            image = `/images/blogs/${filename}`;
        }

        const newBlog = new Blog({
            title,
            slug,
            coverImage: image,
            contentBlocks: parsedBlocks,
            tags: tags ? tags.split(',') : [],
            metaDescription,
        });

        await newBlog.save();
        res.status(201).json({ message: 'Blog created successfully', blog: newBlog });
    } catch (err) {
        console.error('❌ Error creating blog:', err);
        res.status(500).json({ message: 'Failed to create blog' });
    }
};

// --- Update Blog ---
export const updateBlog = async (req, res) => {
    try {
        const { title, contentBlocks, tags, metaDescription } = req.body;
        const parsedBlocks =
            typeof contentBlocks === 'string'
                ? JSON.parse(contentBlocks)
                : contentBlocks;
        const slug = slugify(title, { lower: true, strict: true });

        const updatedFields = {
            title,
            slug,
            contentBlocks: parsedBlocks,
            tags: tags ? tags.split(',') : [],
            metaDescription,
        };

        if (req.file) {
            const ext = path.extname(req.file.originalname);
            const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
            const filename = `${slug}-${unique}${ext}`;
            saveToBothBlogDirs(filename, req.file.buffer);
            updatedFields.coverImage = `/images/blogs/${filename}`;
        }

        const blog = await Blog.findByIdAndUpdate(req.params.id, updatedFields, { new: true });
        if (!blog) return res.status(404).json({ message: 'Blog not found' });

        res.json({ message: 'Blog updated', blog });
    } catch (err) {
        console.error('Error updating blog:', err);
        res.status(500).json({ message: 'Failed to update blog' });
    }
};

  

// Get all blogs (admin list with optional search/pagination)
export const getAllBlogs = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;

        const query = search
            ? { title: { $regex: search, $options: 'i' } }
            : {};

        const [blogs, total] = await Promise.all([
            Blog.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
            Blog.countDocuments(query),
        ]);

        res.json({ blogs, total });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching blogs' });
    }
};

export const getSingleBlog = async (req, res) => {
    try {
        const rawSlug = req.params.slug;
        const decodedSlug = decodeURIComponent(rawSlug);
        console.log('Requested slug:', decodedSlug);

        const blog = await Blog.findOne({ slug: decodedSlug });

        if (!blog) {
            console.log('No blog found for slug:', decodedSlug);
            return res.status(404).json({ message: 'Blog not found' });
        }

        res.json(blog);
    } catch (err) {
        console.error('Error fetching blog:', err);
        res.status(500).json({ message: 'Server error while fetching blog' });
    }
};
  
  
// Get single blog (for detail or edit)
export const getBlogById = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ message: 'Blog not found' });
        res.json(blog);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching blog' });
    }
};





// Delete blog
export const deleteBlog = async (req, res) => {
    try {
        const blog = await Blog.findByIdAndDelete(req.params.id);
        if (!blog) return res.status(404).json({ message: 'Blog not found' });
        res.json({ message: 'Blog deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete blog' });
    }
};
