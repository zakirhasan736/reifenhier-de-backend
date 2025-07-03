import Blog from '../../models/Blog.js';
import slugify from 'slugify';
import dotenv from 'dotenv';
dotenv.config()
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('Cloudinary config', {
    name: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY,
    secret: process.env.CLOUDINARY_API_SECRET,
});
  

// Multer storage for blog images
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'blogs',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
    },
});

export const upload = multer({ storage });

// Create blog
export const createBlog = async (req, res) => {
    try {
        console.log('Incoming blog payload:', req.body);
        console.log('Uploaded file:', req.file);

        const { title, contentBlocks, tags, metaDescription } = req.body;

        if (!contentBlocks) {
            return res.status(400).json({ message: 'Content blocks are required' });
        }

        const parsedBlocks = typeof contentBlocks === 'string' ? JSON.parse(contentBlocks) : contentBlocks;
        // Normalize slug
        const slug = slugify(title, { lower: true, strict: true });

        // Optional: check if slug already exists
        const existing = await Blog.findOne({ slug });
        if (existing) {
            return res.status(400).json({ message: 'A blog with this title already exists.' });
        }
        // const slug = title.toLowerCase().replace(/\s+/g, '-');
        const image = req.file?.path;

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
        console.error('❌ Error creating blog:', err); // 👈 This is what you should look for
        res.status(500).json({ message: 'Failed to create blog' });
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



// Update blog
export const updateBlog = async (req, res) => {
    try {
        const { title, contentBlocks, tags, metaDescription } = req.body;
        const parsedBlocks = typeof contentBlocks === 'string' ? JSON.parse(contentBlocks) : contentBlocks;

        const updatedFields = {
            title,
            slug: title.toLowerCase().replace(/\s+/g, '-'),
            contentBlocks: parsedBlocks,
            tags: tags ? tags.split(',') : [],
            metaDescription,
        };

        if (req.file?.path) {
            updatedFields.coverImage = req.file.path;
        }

        const blog = await Blog.findByIdAndUpdate(req.params.id, updatedFields, { new: true });
        if (!blog) return res.status(404).json({ message: 'Blog not found' });

        res.json({ message: 'Blog updated', blog });
    } catch (err) {
        console.error('Error updating blog:', err);
        res.status(500).json({ message: 'Failed to update blog' });
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
